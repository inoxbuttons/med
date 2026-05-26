import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isPlaceholderValue, isMissingPhone, isMissingBirthday } from '../integrations/shared/patient-data-utils';
import { findDayWord, toDateStr } from '../integrations/shared/date-utils';
import { OpenAiService } from '../llm/openai.service';
import { GigaChatService } from '../llm/gigachat.service';
import { QwenService } from '../llm/qwen.service';
import { CompletionResult, LlmTool } from '../llm/llm.types';
import { BookingService } from '../booking/booking.service';
import { TokenUsage } from '../database/entities/token-usage.entity';
import { LlmUsage } from '../llm/llm.types';
import {
  ChatMessage,
  EncryptedPatient,
  LlmProvider,
  PatientData,
  PendingConflict,
  SendMessageDto,
  SendMessageResponse,
  SessionData,
  SessionState,
} from './chat.types';

const MAX_TOOL_ITERATIONS = 6;

// После вызова любого из этих инструментов пациент уже на стадии бронирования —
// «обзорные» инструменты POST_DISCOVERY_DROP больше не нужны и не отправляются в LLM.
const DISCOVERY_TOOLS = new Set(['find_doctors_and_slots', 'find_available_at_time', 'find_services']);
const POST_DISCOVERY_DROP = new Set(['get_clinics', 'find_services']);

// Инструменты-поиски, чьи громоздкие результаты можно убирать из истории
// после показа сводки/успешной записи — пациент уже выбрал слот.
const COMPACTABLE_SEARCH_TOOLS = new Set([
  'find_doctors',
  'find_doctors_and_slots',
  'find_services',
  'get_available_slots',
  'find_available_at_time',
  'get_clinics',
]);

// Инструменты, у которых в схеме есть date/dayOfWeek/nextWeek/mode/targetDate —
// только их args обрабатывает normalizeDateArgs.
const DATE_AWARE_TOOLS = new Set([
  'find_doctors_and_slots',
  'find_available_at_time',
  'get_available_slots',
  'find_patient_appointment',
]);

/**
 * Возвращает множество известных дат (YYYY-MM-DD) из результатов search-инструментов
 * в истории сессии. Используется для валидации `book_appointment.startTime`:
 * LLM иногда выдумывает дату («написала 29 мая вместо 22 мая») и подставляет её
 * в startTime — серверная проверка отвергает такие вызовы.
 */
function extractValidSlotDates(msgs: ChatMessage[]): Set<string> {
  const dates = new Set<string>();
  for (const m of msgs) {
    if (m.role !== 'function') continue;
    const name = m.name ?? '';
    if (!['find_doctors_and_slots', 'find_services', 'get_available_slots', 'find_available_at_time'].includes(name)) continue;
    try {
      const parsed = JSON.parse(m.content);
      const arr = Array.isArray(parsed) ? parsed : (parsed?.available ?? parsed?.nearest ?? []);
      for (const r of arr) {
        if (r?.slot?.date) dates.add(r.slot.date);
        if (r?.date) dates.add(r.date); // get_available_slots возвращает группы с date
        if (Array.isArray(r?.allSlots)) {
          for (const s of r.allSlots) {
            if (s?.date) dates.add(s.date);
            if (s?.dtSlot?.dt_start) dates.add(String(s.dtSlot.dt_start).slice(0, 10));
          }
        }
      }
    } catch { /* ignore parse errors */ }
  }
  return dates;
}

/**
 * Возвращает копию массива сообщений без пар «assistant.function_call(<search>)
 * → function(<search-result>)». Используется для удаления списков врачей/слотов
 * из истории, когда они уже не нужны (показана сводка/запись создана).
 */
function compactSearchPairs(msgs: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (
      m.role === 'assistant' &&
      m.function_call &&
      COMPACTABLE_SEARCH_TOOLS.has(m.function_call.name) &&
      i + 1 < msgs.length &&
      msgs[i + 1].role === 'function' &&
      msgs[i + 1].name === m.function_call.name
    ) {
      i++;
      continue;
    }
    out.push(m);
  }
  return out;
}

/**
 * Префикс «свёрнутой» заметки о завершённой записи. На следующем ходе sendMessage
 * заменяет весь объём диалога одной записи (find_*, book_appointment, summary, "да", success-text)
 * на одну assistant-заметку этого формата. Данные пациента (session.patient) и список
 * UUID-ов (session.recentBookings) живут в session-state, не теряются.
 */
const BOOKING_NOTE_PREFIX = '[Активная запись пациента] ';

/** "2026-05-14T12:00:00" / "2026-05-14 12:00" → "14.05.2026 12:00" */
function formatRuDateTime(iso: string): string {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
}

// Ключевые слова, указывающие на медицинский симптом / жалобу
const SYMPTOM_PATTERNS = [
  /болит|болит|боль|болью|болезненн/i,
  /тошнит|тошнота|рвот/i,
  /температура|жар|лихорадк/i,
  /кашл|насморк|горло|чихает/i,
  /кружится|головокружени/i,
  /давление|сердцебиение|одышк/i,
  /зуд|сыпь|покраснени/i,
  /плохо себя чувству|нехорошо|недомогани/i,
  /слабост|усталост|упадок сил/i,
  /отёк|опухл|припухл/i,
  /судорог|онемени|покалыван/i,
];

function isSymptomMessage(text: string): boolean {
  return SYMPTOM_PATTERNS.some((re) => re.test(text));
}

/**
 * Экстренные ситуации, при которых ассистент НЕ должен предлагать запись —
 * вместо этого подскажет звонить 103/112. Покрывает: острая боль в груди,
 * потеря сознания, удушье, обширное кровотечение, инсульт-признаки, ребёнок
 * проглотил инородное тело, очень высокая температура у ребёнка, судороги,
 * травма с невозможностью двигаться, отравление, ожог большой площади.
 */
const EMERGENCY_PATTERNS: RegExp[] = [
  /(резкая|острая|сильная|невыносим).{0,30}боль.{0,30}(груд|сердц)/iu,
  /(не могу|трудно|тяжело).{0,30}дыша/iu,
  /(задыха|удушь|перехватило дыхан)/iu,
  /(потеря(л|ла)?|теряет).{0,15}сознани/iu,
  /(без сознан|без созн)/iu,
  /(инсульт|инфаркт)/iu,
  /(сильн[а-яё]+\s+кровотечен|обильн[а-яё]+\s+кровотечен|кровотечен[а-яё]+\s+(сильн|обильн|остановить))/iu,
  /(не могу|невозможно).{0,20}(шевел|двигать|встать).{0,40}(нога|рука|конечн)/iu,
  /(проглотил|проглотила|глотнул).{0,40}(батаре|монет|игл|таблетк|острое|инородн)/iu,
  /(температур[а-яё]*\s*(под|до|выше|за)?\s*(39|40|41)|жар.{0,20}(39|40|41))/iu,
  /(судорог[а-яё]*|конвульси)/iu,
  /(отравлен|отравил|выпил.{0,20}(хими|кислот|щёлоч|щелоч|таблет))/iu,
  /(ожог.{0,30}(больш|обширн|сильн|кипяток|пламя))/iu,
  /(парализ|онемел[а-яё]*\s+(половина|сторона|тело))/iu,
  /(перелом\s+открыт|открытый\s+перелом|кость.{0,15}торчит)/iu,
  /(аллерги|анафилак).{0,30}(шок|опух|задыха|отёк)/iu,
];

function isEmergencyMessage(text: string): boolean {
  return EMERGENCY_PATTERNS.some((re) => re.test(text));
}

const EMERGENCY_REPLY =
  'Это похоже на экстренную ситуацию. Срочно позвоните в скорую помощь: **103** ' +
  '(с мобильного — **112**). Если возможно, оставайтесь с пострадавшим до приезда ' +
  'врачей. Запись в клинике в такой ситуации не нужна — медлить нельзя.';

/**
 * Время суток по сообщению пациента. Используется для пост-фильтра allSlots
 * в результатах find_doctors_and_slots / find_services.
 *   morning   06:00–12:00
 *   afternoon 12:00–16:00
 *   evening   16:00–22:00
 */
type TimeOfDay = 'morning' | 'afternoon' | 'evening';

function extractTimeOfDay(text: string): TimeOfDay | null {
  // \b в JS regex работает только для ASCII, поэтому используем lookbehind
  // (?<![а-яё]) — «не предшествует кириллической буквой».
  if (/(?<![а-яё])(утр(ом|енн)|с утр[аоу])/iu.test(text)) return 'morning';
  if (/(?<![а-яё])(вечер(ом|н)|под вечер)/iu.test(text)) return 'evening';
  if (/(?<![а-яё])(днём|в обед|после обеда|дневн)/iu.test(text)) return 'afternoon';
  return null;
}

function extractTimeOfDayFromUserMessage(session: SessionData): TimeOfDay | null {
  const lastUser = [...session.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser?.content) return null;
  return extractTimeOfDay(lastUser.content);
}

/** Час слота "HH:MM" → число 0..23. */
function slotHour(time: string): number {
  return parseInt(time.split(':')[0], 10);
}

function isInTimeOfDay(time: string, tod: TimeOfDay): boolean {
  const h = slotHour(time);
  if (isNaN(h)) return true;
  if (tod === 'morning')   return h >= 6  && h < 12;
  if (tod === 'afternoon') return h >= 12 && h < 16;
  return h >= 16 && h < 22;
}

/**
 * Фильтрует allSlots по времени суток. Если у врача не остаётся слотов —
 * isAvailable=false, slot=null (LLM не предложит его, но видит, что есть другие).
 */
function filterSlotsByTimeOfDay(result: unknown, tod: TimeOfDay): unknown {
  if (!Array.isArray(result)) return result;
  // Сначала фильтруем слоты по времени суток, затем выбрасываем врачей,
  // у которых ничего не осталось — LLM иначе путается, когда часть docs
  // помечены isAvailable=false и описывает их как «нет окон вообще».
  const mapped = result.map((entry: any) => {
    if (!entry || typeof entry !== 'object') return entry;
    if (!Array.isArray(entry.allSlots)) {
      if (entry.slot && entry.slot.time && !isInTimeOfDay(entry.slot.time, tod)) {
        return null;
      }
      return entry;
    }
    const filtered = entry.allSlots.filter((s: any) => s?.time && isInTimeOfDay(s.time, tod));
    if (filtered.length === 0) return null;
    const first = filtered[0];
    return {
      ...entry,
      isAvailable: true,
      allSlots: filtered,
      slot: entry.slot
        ? { ...entry.slot, time: first.time, date: first.date }
        : { time: first.time, date: first.date },
    };
  });
  return mapped.filter((e) => e !== null);
}


const CLINIC_SPECIALISTS =
  'Терапевт, Невролог, Кардиолог, Гастроэнтеролог, Эндокринолог, Гинеколог, ' +
  'Акушер-гинеколог, Уролог, Офтальмолог, Травматолог-ортопед, Хирург, ' +
  'Аллерголог-иммунолог, Дерматовенеролог, Оториноларинголог, ' +
  'Онколог-маммолог, Нефролог, Проктолог, Врач УЗИ';

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);
  private readonly sessions = new Map<string, SessionData>();
  private readonly systemPrompt: string;
  private readonly defaultProvider: LlmProvider;
  private readonly SESSION_TTL_MS = 30 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly openAi: OpenAiService,
    private readonly gigaChat: GigaChatService,
    private readonly qwen: QwenService,
    private readonly booking: BookingService,
    @InjectRepository(TokenUsage)
    private readonly tokenUsageRepo: Repository<TokenUsage>,
  ) {
    const promptFile = path.resolve(__dirname, '../prompts/system-prompt.txt');
    const defaultPrompt = fs.readFileSync(promptFile, 'utf-8').trim();
    this.systemPrompt = this.config.get<string>('CHAT_SYSTEM_PROMPT', defaultPrompt);
    // По умолчанию из .env: CHAT_DEFAULT_PROVIDER=qwen|gigachat|openai.
    this.defaultProvider = (this.config.get<string>('CHAT_DEFAULT_PROVIDER') as LlmProvider) ?? 'gigachat';
  }

  /**
   * Единая точка вызова LLM — переключает провайдера по строке.
   * forceText=true означает «без tool-вызовов» (для conflict/confirmation текстовых ответов).
   */
  private async callLlm(
    provider: LlmProvider,
    context: ChatMessage[],
    tools: LlmTool[],
    model: string | undefined,
    forceText: boolean,
  ): Promise<CompletionResult> {
    switch (provider) {
      case 'gigachat':
        return this.gigaChat.complete(context, tools, model, forceText);
      case 'qwen':
        return this.qwen.complete(context, tools, model, forceText);
      case 'openai':
      default:
        return this.openAi.complete(context, forceText ? [] : tools, model);
    }
  }

  onModuleInit() {
    setInterval(() => this.cleanExpiredSessions(), 10 * 60 * 1000);
  }

  async sendMessage(dto: SendMessageDto): Promise<SendMessageResponse> {
    const { sessionId, message, provider = this.defaultProvider, model, clientId, clinicNetId, misType, townId, districtId, encryptedPatient } = dto;

    const session = this.getOrCreateSession(sessionId, provider, model);
    // Обновляем идентификаторы сессии если переданы
    if (clientId    !== undefined) session.clientId    = clientId;
    if (clinicNetId !== undefined) session.clinicNetId = clinicNetId;
    if (townId      !== undefined) session.townId      = townId;
    if (districtId  !== undefined) session.districtId  = districtId;
    // misType устанавливается один раз при первом запросе и не меняется
    if (misType !== undefined && session.misType === undefined) session.misType = misType;
    // Расшифровываем данные пациента при первом запросе (один раз)
    if (encryptedPatient && !session.patient) {
      try {
        session.patient = decryptPatientData(encryptedPatient, this.config.get<string>('PATIENT_DATA_PRIVATE_KEY', ''));
      } catch (err) {
        this.logger.warn(`Failed to decrypt patient data for session ${sessionId}: ${String(err)}`);
      }
    }
    // Сворачиваем завершённые записи из прошлых ходов в краткие assistant-заметки —
    // history клиенту прошлого хода уже ушёл целиком, дальше LLM достаточно одной строки на запись.
    this.foldCompletedBookings(session);

    session.messages.push({ role: 'user', content: message });
    session.updatedAt = new Date();

    // Resolve pending confirmation: пользователь ответил "да"/"подтверждаю" после того, как мы спросили.
    // Серверно исполняем сохранённый вызов — страхует от галлюцинации LLM "оформлено" без реального tool-call.
    if (session.pendingConfirmation) {
      const pcfm = session.pendingConfirmation;
      const trimmed = message.trim();
      const declined = /^\s*(нет|не\s|не,|отказ|отмен)/i.test(trimmed);
      // Word-boundary через lookbehind/lookahead кириллицы — иначе «да» matchит «давно», «ок» — «окно» и т.д.
      const confirmedRe = /(?<![а-яё])(да|подтверждаю|записывайте|запишите|конечно|окей|ок)(?![а-яё])/i;

      if (!declined && confirmedRe.test(trimmed)) {
        session.pendingConfirmation = undefined;

        let toolResult: unknown;
        if (pcfm.toolName === 'reschedule_appointment' && !session.misType) {
          // Local DB: атомарный перенос (cancel+book одной транзакцией).
          toolResult = await this.booking.rescheduleAppointment({
            oldId: pcfm.toolArgs.oldId,
            type: pcfm.toolArgs.type,
            doctorId: pcfm.toolArgs.doctorId,
            serviceId: pcfm.toolArgs.serviceId,
            clinicId: pcfm.toolArgs.clinicId,
            newStartTime: pcfm.toolArgs.newStartTime,
            patientId: session.clientId,
          });
        } else {
          toolResult = await this.booking.executeTool(
            pcfm.toolName,
            pcfm.toolArgs,
            sessionId,
            session.clientId,
            session.misType ?? undefined,
            session.clinicNetId,
            session.townId,
            session.districtId,
            session.patient,
          );
          if (pcfm.toolName === 'book_appointment') {
            this.rememberMedflexBooking(session, pcfm.toolArgs, toolResult);
          } else if (pcfm.toolName === 'cancel_appointment' && pcfm.toolArgs.uuid) {
            this.forgetMedflexBooking(session, String(pcfm.toolArgs.uuid));
          }
        }

        // GigaChat-Pro требует assistant.function_call перед каждым function-результатом.
        session.messages.push({
          role: 'assistant',
          content: '',
          function_call: { name: pcfm.toolName, arguments: JSON.stringify(pcfm.toolArgs) },
        });
        session.messages.push({
          role: 'function',
          name: pcfm.toolName,
          content: JSON.stringify(toolResult),
        });

        // MedFlex 409: ставим pendingConflict — runToolLoop через системный промпт продолжит диалог.
        if ((toolResult as any)?.conflict === true && pcfm.toolName === 'book_appointment') {
          const cr = toolResult as any;
          session.pendingConflict = {
            oldId: 0,
            oldType: 'doctor',
            oldUuid: cr.existingAppointment?.uuid,
            existingDescription: cr.existingAppointment?.description,
            newDoctorId: pcfm.toolArgs.doctorId,
            newServiceId: pcfm.toolArgs.serviceId,
            newClinicId: pcfm.toolArgs.clinicId,
            newStartTime: pcfm.toolArgs.startTime,
            pendingBookingArgs: cr.pendingBookingArgs,
          };
          session.state = 'conflict_resolution';
        } else if ((toolResult as any)?.success === true) {
          // Сначала фиксируем заметку (пока search-результаты ещё в истории),
          // потом компакт. КАНСЕЛ не компактим — после отмены пациент часто
          // делает следом book_appointment, и search-результаты ещё нужны.
          const r = toolResult as { uuid?: string };
          if (pcfm.toolName === 'book_appointment') {
            if (r.uuid) this.recordCompletedBooking(session, pcfm.toolArgs, r.uuid);
            this.compactSearchResults(session);
          } else if (pcfm.toolName === 'reschedule_appointment') {
            this.compactSearchResults(session);
          }
          // cancel_appointment — без компакта.
        }
      } else {
        // Любой другой ответ → отменяем подтверждение, LLM продолжит диалог.
        session.pendingConfirmation = undefined;
      }
    }

    // Resolve pending conflict before LLM call, based on user's answer.
    if (session.pendingConflict) {
      const pc = session.pendingConflict;
      const wantsReplace = /замени|заменить|замените|заменяй/i.test(message);
      const wantsOtherTime = /другое время|другой|выберу|выбрать|перенесем|перенести|поменяем|поменять время/i.test(message);

      if (wantsReplace) {
        session.pendingConflict = undefined;
        session.state = 'idle';
        let rescheduleResult: unknown;
        if (session.misType === 'medflex' && pc.oldUuid) {
          // MedFlex: cancel old by UUID, then rebook with stored args
          await this.booking.executeTool('cancel_appointment', { uuid: pc.oldUuid }, sessionId, session.clientId, session.misType, session.clinicNetId, session.townId, session.districtId, session.patient);
          this.forgetMedflexBooking(session, pc.oldUuid);
          const rebookArgs = pc.pendingBookingArgs ?? { doctorId: pc.newDoctorId, clinicId: pc.newClinicId, startTime: pc.newStartTime };
          rescheduleResult = await this.booking.executeTool('book_appointment', rebookArgs, sessionId, session.clientId, session.misType, session.clinicNetId, session.townId, session.districtId, session.patient);
          this.rememberMedflexBooking(session, rebookArgs, rescheduleResult);
        } else if (session.misType && session.misType !== 'medflex') {
          // Other external MIS
          await this.booking.executeTool('cancel_appointment', { id: pc.oldId, type: pc.oldType }, sessionId, session.clientId, session.misType, session.clinicNetId, session.townId, session.districtId, session.patient);
          rescheduleResult = await this.booking.executeTool('book_appointment', { doctorId: pc.newDoctorId, serviceId: pc.newServiceId, clinicId: pc.newClinicId, startTime: pc.newStartTime }, sessionId, session.clientId, session.misType, session.clinicNetId, session.townId, session.districtId, session.patient);
        } else {
          // Local DB: atomic reschedule (cancel old + book new)
          rescheduleResult = await this.booking.rescheduleAppointment({
            oldId: pc.oldId,
            type: pc.oldType,
            doctorId: pc.newDoctorId,
            serviceId: pc.newServiceId,
            clinicId: pc.newClinicId,
            newStartTime: pc.newStartTime,
            patientId: session.clientId,
          });
        }
        // GigaChat-Pro requires assistant function_call before every function result
        session.messages.push({ role: 'assistant', content: '', function_call: { name: 'reschedule_appointment', arguments: JSON.stringify({ oldId: pc.oldUuid ?? pc.oldId, newStartTime: pc.newStartTime }) } });
        session.messages.push({ role: 'function', name: 'reschedule_appointment', content: JSON.stringify(rescheduleResult) });
      } else if (wantsOtherTime || (session.misType === 'medflex' && /оставить|оставь|другой|нет/i.test(message))) {
        // User wants to pick a different time — clear conflict state
        session.pendingConflict = undefined;
        session.state = 'idle';
      } else if (/оставить|оставь|оставьте|оставим|оставляем|обе|оба|не замен/i.test(message)) {
        session.pendingConflict = undefined;
        session.state = 'idle';
        const keepBothArgs = pc.pendingBookingArgs ?? {
          doctorId: pc.newDoctorId,
          serviceId: pc.newServiceId,
          clinicId: pc.newClinicId,
          startTime: pc.newStartTime,
        };
        const bookResult = await this.booking.executeTool(
          'book_appointment',
          keepBothArgs,
          sessionId,
          session.clientId,
          session.misType ?? undefined,
          session.clinicNetId,
          session.townId,
          session.districtId,
          session.patient,
        );
        this.rememberMedflexBooking(session, keepBothArgs, bookResult);
        // GigaChat-Pro requires assistant function_call before every function result
        session.messages.push({ role: 'assistant', content: '', function_call: { name: 'book_appointment', arguments: JSON.stringify({ doctorId: pc.newDoctorId, clinicId: pc.newClinicId, startTime: pc.newStartTime }) } });
        session.messages.push({ role: 'function', name: 'book_appointment', content: JSON.stringify(bookResult) });
      }
    }

    const tools = this.booking.getTools(session.misType ?? undefined, !!session.patient);

    // Build full context with system prompt prepended
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const todayDayName = dayNames[today.getDay()];
    let systemWithDate =
      `${this.systemPrompt}\nСегодня: ${todayStr} (${todayDayName}). ` +
      `Для слов "вторник"/"завтра"/"послезавтра" используй dayOfWeek; date — только для явных дат с числом.`;

    // Гостевой режим MedFlex: пациент не авторизован, операции с существующими записями недоступны.
    if (session.misType === 'medflex' && !session.patient) {
      systemWithDate +=
        `\n\nГОСТЕВОЙ РЕЖИМ MedFlex: операции "мои записи"/"отменить"/"перенести" недоступны — для этого пациенту нужно войти в личный кабинет клиники.`;
    }

    // MedFlex: данные пациента уже известны — больше не спрашиваем при последующих записях.
    if (session.misType === 'medflex' && session.patient) {
      systemWithDate +=
        `\n\nДанные пациента уже в сессии — не спрашивай повторно. В book_appointment передавай только doctorId, clinicId, specialityId, startTime, endTime, price.`;
    }

    // MedFlex: записи, созданные в текущей сессии — для отмены/переноса используем
    // completedBookingNotes (есть doctorName, специальность, услуга, клиника + uuid),
    // не recentBookings (там только uuid+time).
    if (session.misType === 'medflex' && session.completedBookingNotes && session.completedBookingNotes.length > 0) {
      systemWithDate +=
        `\n\nЗАПИСИ ПАЦИЕНТА В ТЕКУЩЕЙ СЕССИИ:\n` +
        session.completedBookingNotes.map((n, i) => `${i + 1}. ${n}`).join('\n') +
        `\nДля отмены/переноса используй uuid НАПРЯМУЮ (без get_patient_appointments). ` +
        `Если запись одна — используй её uuid без уточнений. Если несколько — выбери правильную по упомянутой пациентом специальности/врачу/услуге.`;
    }

    // Rec 6+7: merge conflict state into the system prompt (GigaChat requires system to be first message only)
    if (session.state === 'conflict_resolution' && session.pendingConflict) {
      const pc = session.pendingConflict;
      if (pc.oldUuid) {
        // MedFlex: old appointment identified by UUID
        const desc = pc.existingDescription ?? pc.oldUuid;
        systemWithDate +=
          `\n\nТЕКУЩЕЕ СОСТОЯНИЕ: режим разрешения конфликта MedFlex.` +
          ` Существующая запись: ${desc}.` +
          ` Ожидается ответ пациента: "заменить" (отменить старую и создать новую) или "выбрать другое время".` +
          ` НЕ вызывай инструменты.`;
      } else {
        // Local DB
        systemWithDate +=
          `\n\nТЕКУЩЕЕ СОСТОЯНИЕ: режим разрешения конфликта.` +
          ` Существующая запись: ${pc.oldId} (тип: ${pc.oldType}), новое время: ${pc.newStartTime}.` +
          ` Ожидается ответ пациента: "оставить обе записи" или "заменить старую".` +
          ` НЕ предлагай новых записей. НЕ вызывай инструменты.`;
      }
    }

    let reply: string;
    try {
      // Экстренные ситуации (боль в груди, удушье, инсульт, ребёнок проглотил
      // инородное тело, температура > 39 у ребёнка и т.д.) — не записываем,
      // отправляем в 103/112. Серверная проверка надёжнее, чем доверять LLM.
      if (isEmergencyMessage(message)) {
        reply = EMERGENCY_REPLY;
      } else if (isSymptomMessage(message) && session.misType !== 'medflex') {
        // Symptom shortcut only for local DB / infoclinica — for MedFlex the tool loop
        // handles symptoms via find_doctors with real specialities from the API
        reply = await this.handleSymptomMessage(message, systemWithDate, session, sessionId);
      } else {
        const context: ChatMessage[] = [
          { role: 'system', content: systemWithDate },
          ...session.messages,
        ];
        reply = await this.runToolLoop(session, context, tools, sessionId);
      }
    } catch (err) {
      this.logger.error(`LLM error for session ${sessionId}: ${String(err)}`);
      throw err;
    }

    session.messages.push({ role: 'assistant', content: reply });
    session.updatedAt = new Date();

    this.logger.debug(`Session ${sessionId}: ${session.messages.length} messages`);

    return { sessionId, reply, history: [...session.messages] };
  }

  private async handleSymptomMessage(
    message: string,
    systemPrompt: string,
    session: SessionData,
    sessionId: string,
  ): Promise<string> {
    const symptomSystemPrompt =
      `Ты — медицинский ассистент клиники. ` +
      `Пациент описал жалобу. Ответь СТРОГО по шаблону (2–3 предложения): ` +
      `сначала кратко объясни возможные причины симптома (без постановки диагноза), ` +
      `затем предложи записаться к одному или двум специалистам из этого списка: ${CLINIC_SPECIALISTS}. ` +
      `Заверши вопросом "Записать вас?". Не задавай других вопросов.`;

    const context: ChatMessage[] = [
      { role: 'system', content: symptomSystemPrompt },
      // Include recent history for context (last 4 messages), but not tool calls
      ...session.messages.slice(-5, -1).filter((m) => m.role === 'user' || m.role === 'assistant'),
      { role: 'user', content: message },
    ];

    const result = await this.callLlm(session.provider, context, [], session.model, true);

    this.saveUsage(result.usage, sessionId, session.clinicNetId, session.provider);
    return result.type === 'text' ? result.content : 'Пожалуйста, обратитесь к специалисту клиники.';
  }

  private async runToolLoop(
    session: SessionData,
    context: ChatMessage[],
    tools: ReturnType<BookingService['getTools']>,
    sessionId: string,
  ): Promise<string> {
    // Если стадия «найти врача со слотом» уже пройдена в предыдущих ходах сессии —
    // сразу убираем обзорные инструменты, не дожидаясь повторного вызова.
    let activeTools = session.messages.some(
      (m) => m.role === 'function' && m.name !== undefined && DISCOVERY_TOOLS.has(m.name),
    )
      ? tools.filter((t) => !POST_DISCOVERY_DROP.has(t.name))
      : tools;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const isLastIteration = i === MAX_TOOL_ITERATIONS - 1;
      const result = await this.callLlm(session.provider, context, activeTools, session.model, isLastIteration);

      this.saveUsage(result.usage, sessionId, session.clinicNetId, session.provider);

      if (result.type === 'text') {
        return result.content;
      }

      // Нормализуем даты в args ДО записи в историю — иначе LLM продолжит
      // оперировать своей же кривой датой ("2026-05-23" вместо "пятница").
      this.normalizeDateArgs(result.toolName, result.toolArgs, session);

      // Tool call — append assistant message with function_call to context and session
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: '',
        function_call: {
          name: result.toolName,
          arguments: JSON.stringify(result.toolArgs),
        },
        ...(result.functionsStateId ? { functions_state_id: result.functionsStateId } : {}),
      };
      context.push(assistantMsg);
      session.messages.push(assistantMsg);

      this.logger.debug(`Tool call: ${result.toolName}(${JSON.stringify(result.toolArgs)})`);

      // Rec 9: block book_appointment while conflict is unresolved
      if (result.toolName === 'book_appointment' && session.state === 'conflict_resolution') {
        const retryBlockMsg: ChatMessage = {
          role: 'function',
          name: result.toolName,
          content: JSON.stringify({
            success: false,
            reason: 'conflict_unresolved',
            error: 'Сначала нужно выбрать: оставить обе записи или заменить старую на новую.',
          }),
        };
        context.push(retryBlockMsg);
        session.messages.push(retryBlockMsg);
        continue;
      }

      // Guard: book_appointment / reschedule_appointment / cancel_appointment require
      // explicit confirmation в последнем сообщении пользователя. Защита от
      // случайных отмен и галлюцинаций «успешно оформлено».
      if (result.toolName === 'book_appointment' || result.toolName === 'reschedule_appointment' || result.toolName === 'cancel_appointment') {
        // Гостевой MedFlex: данные пациента должны быть СОБРАНЫ у пользователя до вызова book_appointment.
        // Эта проверка идёт ДО confirmation_required, иначе LLM получает сигнал "спроси подтверждение"
        // вместо "спроси данные" и продолжает слать плейсхолдеры. Дублирует валидатор в medflex.service.ts
        // как defense-in-depth.
        if (
          result.toolName === 'book_appointment' &&
          session.misType === 'medflex' &&
          !session.patient
        ) {
          const missing: string[] = [];
          if (isPlaceholderValue(result.toolArgs.firstName)) missing.push('имя');
          if (isPlaceholderValue(result.toolArgs.lastName))  missing.push('фамилию');
          if (isMissingPhone(result.toolArgs.phone))         missing.push('телефон');
          if (isMissingBirthday(result.toolArgs.birthday))   missing.push('дату рождения');
          if (missing.length > 0) {
            const dataMsg: ChatMessage = {
              role: 'function',
              name: result.toolName,
              content: JSON.stringify({
                success: false,
                reason: 'patient_data_required',
                message:
                  `Данные пациента не получены (${missing.join(', ')}). ` +
                  `НЕ вызывай book_appointment с плейсхолдерами или пустыми значениями. ` +
                  `Сначала одним сообщением спроси у пользователя фамилию, имя, отчество, телефон и дату рождения, дождись ответа, ` +
                  `затем покажи сводку, спроси подтверждение и только после "да" вызывай book_appointment с РЕАЛЬНЫМИ значениями.`,
              }),
            };
            context.push(dataMsg);
            session.messages.push(dataMsg);
            continue;
          }
        }

        // Bug-fix: LLM иногда выдумывает дату в reply и подставляет её в startTime,
        // вместо того чтобы взять dtSlot из allSlots. Сравниваем дату startTime
        // со множеством известных дат слотов из истории. Если не совпадает —
        // отвергаем и просим взять dtSlot.
        if (result.toolName === 'book_appointment' && typeof result.toolArgs.startTime === 'string') {
          const validDates = extractValidSlotDates(session.messages);
          if (validDates.size > 0) {
            const reqDate = result.toolArgs.startTime.slice(0, 10);
            if (!validDates.has(reqDate)) {
              const dateMsg: ChatMessage = {
                role: 'function',
                name: result.toolName,
                content: JSON.stringify({
                  success: false,
                  reason: 'invalid_slot_date',
                  message:
                    `Дата startTime "${reqDate}" не соответствует ни одному найденному слоту. ` +
                    `Доступные даты слотов: ${[...validDates].sort().join(', ')}. ` +
                    `Возьми startTime/endTime ИЗ dtSlot выбранного слота в allSlots — не вычисляй дату из текста.`,
                }),
              };
              context.push(dateMsg);
              session.messages.push(dateMsg);
              continue;
            }
          }
        }

        const lastUserMsg = session.messages
          .filter((m) => m.role === 'user')
          .slice(-1)[0]?.content ?? '';
        // Note: \b doesn't work with Cyrillic in JS — check plain substrings
        // Word-boundary через lookbehind/lookahead кириллицы — иначе «да» matchит «давно», «ок» — «окно» и т.д.
        const confirmed = /(?<![а-яё])(да|подтверждаю|записывайте|запишите|конечно|окей|заменить|замените|ок)(?![а-яё])/i.test(lastUserMsg.trim());
        if (!confirmed) {
          // Сохраняем args, чтобы на следующем ходе сервер сам исполнил запись после "да"/"подтверждаю".
          // Страхует от галлюцинации LLM "успешно оформлено" без реального tool-call.
          session.pendingConfirmation = {
            toolName: result.toolName as 'book_appointment' | 'reschedule_appointment' | 'cancel_appointment',
            toolArgs: { ...result.toolArgs },
          };
          const blockMsg: ChatMessage = {
            role: 'function',
            name: result.toolName,
            content: JSON.stringify({
              success: false,
              reason: 'confirmation_required',
            }),
          };
          context.push(blockMsg);
          session.messages.push(blockMsg);
          // LLM на этом ходе покажет сводку и спросит подтверждение — сырые списки слотов больше не нужны.
          this.compactSearchResults(session, context);
          continue;
        }

        // Rec 5: validate that doctorId or serviceId is present for book_appointment
        if (result.toolName === 'book_appointment' && !result.toolArgs.doctorId && !result.toolArgs.serviceId) {
          const validationMsg: ChatMessage = {
            role: 'function',
            name: result.toolName,
            content: JSON.stringify({
              success: false,
              reason: 'missing_target',
              error: 'Необходимо передать doctorId (для записи к врачу) или serviceId (для услуги).',
            }),
          };
          context.push(validationMsg);
          session.messages.push(validationMsg);
          continue;
        }

        // Warn if patient already has an appointment at the same time slot.
        // Only applicable for local DB — MedFlex/infoclinica handle conflicts on their own.
        if (result.toolName === 'book_appointment' && !session.misType && session.clientId && result.toolArgs.startTime) {
          const conflict = await this.booking.checkPatientTimeConflict(
            session.clientId,
            result.toolArgs.startTime as string,
          );
          if (conflict) {
            // Save conflict for next turn resolution, set conflict_resolution state
            session.pendingConflict = {
              oldId: conflict.id,
              oldType: conflict.type,
              newDoctorId: result.toolArgs.doctorId,
              newServiceId: result.toolArgs.serviceId,
              newClinicId: result.toolArgs.clinicId,
              newStartTime: result.toolArgs.startTime as string,
            } as PendingConflict;
            session.state = 'conflict_resolution';

            const warnMsg: ChatMessage = {
              role: 'function',
              name: result.toolName,
              content: JSON.stringify({
                success: false,
                conflict: true,
                existingAppointment: conflict.description,
              }),
            };
            context.push(warnMsg);
            session.messages.push(warnMsg);

            // Force text response — append conflict instruction to the existing system message (GigaChat requires system first only)
            if (context[0]?.role === 'system') {
              context[0].content +=
                '\n\nТЕКУЩЕЕ СОСТОЯНИЕ: обнаружен конфликт записи.' +
                ' Объясни пациенту ситуацию (поле existingAppointment в последнем результате инструмента),' +
                ' спроси: оставить обе записи или заменить старую на новую? НЕ вызывай инструменты.';
            }
            // state=conflict_resolution + forceText=true → нужен только текст; tool-схемы не шлём (экономия токенов).
            const textResult = await this.callLlm(session.provider, context, [], session.model, true);
            this.saveUsage(textResult.usage, sessionId, session.clinicNetId, session.provider);
            return textResult.type === 'text' ? textResult.content : 'Уточните ваш выбор.';
          }
        }
      }

      // Execute tool
      const toolResult = await this.booking.executeTool(result.toolName, result.toolArgs, sessionId, session.clientId, session.misType ?? undefined, session.clinicNetId, session.townId, session.districtId, session.patient);

      if (result.toolName === 'book_appointment') {
        this.rememberMedflexBooking(session, result.toolArgs, toolResult);
      } else if (result.toolName === 'cancel_appointment' && result.toolArgs.uuid) {
        this.forgetMedflexBooking(session, String(result.toolArgs.uuid));
      }

      // Универсальный компакт после успешной записи/переноса (раньше работал только для medflex).
      const isCompletedBooking =
        (result.toolName === 'book_appointment' || result.toolName === 'reschedule_appointment') &&
        (toolResult as any)?.success === true;
      if (isCompletedBooking) {
        // Сначала фиксируем заметку (пока в session.messages ещё есть search-результаты
        // с doctorName/speciality/serviceName/clinicName), потом компакт.
        const r = toolResult as { uuid?: string };
        if (r.uuid && result.toolName === 'book_appointment') {
          this.recordCompletedBooking(session, result.toolArgs, r.uuid);
        }
        this.compactSearchResults(session, context);
      }

      // MedFlex 409 conflict: save pending conflict and ask user to choose
      if ((toolResult as any)?.conflict === true && result.toolName === 'book_appointment') {
        const cr = toolResult as any;
        session.pendingConflict = {
          oldId: 0,
          oldType: 'doctor',
          oldUuid: cr.existingAppointment?.uuid,
          existingDescription: cr.existingAppointment?.description,
          newDoctorId: result.toolArgs.doctorId,
          newServiceId: result.toolArgs.serviceId,
          newClinicId: result.toolArgs.clinicId,
          newStartTime: result.toolArgs.startTime as string,
          pendingBookingArgs: cr.pendingBookingArgs,
        };
        session.state = 'conflict_resolution';

        const conflictFuncMsg: ChatMessage = {
          role: 'function',
          name: result.toolName,
          content: JSON.stringify(toolResult),
        };
        context.push(conflictFuncMsg);
        session.messages.push(conflictFuncMsg);

        if (context[0]?.role === 'system') {
          context[0].content +=
            '\n\nТЕКУЩЕЕ СОСТОЯНИЕ: обнаружен конфликт записи MedFlex.' +
            ' Объясни пациенту, что в это время уже есть запись (см. поле existingAppointment).' +
            ' Предложи два варианта: "заменить" (отменить старую и создать новую) или "выбрать другое время".' +
            ' НЕ вызывай инструменты.';
        }
        // state=conflict_resolution + forceText=true → нужен только текст; tool-схемы не шлём (экономия токенов).
        const conflictTextResult = await this.callLlm(session.provider, context, [], session.model, true);
        this.saveUsage(conflictTextResult.usage, sessionId, session.clinicNetId, session.provider);
        return conflictTextResult.type === 'text' ? conflictTextResult.content : 'Уточните ваш выбор.';
      }

      // Если пациент попросил «утром»/«вечером»/«днём» — фильтруем allSlots
      // на сервере, чтобы LLM не путалась между врачами с разным графиком
      // (одна работает 09-16, другая 10-18 — «вечером» есть только у второй).
      let filteredResult: unknown = toolResult;
      if (result.toolName === 'find_doctors_and_slots' || result.toolName === 'find_services') {
        const tod = extractTimeOfDayFromUserMessage(session);
        if (tod) filteredResult = filterSlotsByTimeOfDay(toolResult, tod);
      }

      // Append tool result as function message to context and session
      const funcMsg: ChatMessage = {
        role: 'function',
        name: result.toolName,
        content: JSON.stringify(filteredResult),
      };
      context.push(funcMsg);
      session.messages.push(funcMsg);

      // После успешной discovery-стадии сужаем набор инструментов для следующих итераций.
      if (DISCOVERY_TOOLS.has(result.toolName)) {
        activeTools = activeTools.filter((t) => !POST_DISCOVERY_DROP.has(t.name));
      }
    }

    return 'Не удалось обработать запрос. Попробуйте переформулировать.';
  }

  getHistory(sessionId: string): ChatMessage[] {
    return this.sessions.get(sessionId)?.messages ?? [];
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private getOrCreateSession(
    sessionId: string,
    provider: LlmProvider,
    model?: string,
  ): SessionData {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        messages: [],
        provider,
        model,
        state: 'idle',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return this.sessions.get(sessionId)!;
  }

  /**
   * После успешной записи MedFlex: запоминаем данные пациента и UUID записи в сессии,
   * чтобы при следующих действиях (новая запись, отмена, перенос) не спрашивать данные снова.
   */
  private rememberMedflexBooking(
    session: SessionData,
    args: Record<string, any>,
    result: unknown,
  ): void {
    if (session.misType !== 'medflex') return;
    const r = result as { success?: boolean; uuid?: string };
    if (!r?.success || !r.uuid) return;

    // Запоминаем данные пациента из аргументов (только если в сессии их ещё нет — авторизованного клиента не перезаписываем)
    if (!session.patient && args.firstName && args.lastName && args.phone) {
      session.patient = {
        firstName: String(args.firstName),
        lastName: String(args.lastName),
        secondName: args.secondName ? String(args.secondName) : undefined,
        phone: String(args.phone),
        birthday: args.birthday ? String(args.birthday) : '',
      };
    }

    if (!session.recentBookings) session.recentBookings = [];
    if (!session.recentBookings.some((b) => b.uuid === r.uuid)) {
      session.recentBookings.push({
        uuid: r.uuid,
        description: typeof (result as any).message === 'string' ? (result as any).message : '',
        startTime: String(args.startTime ?? ''),
      });
    }
    // Сам компакт теперь делается в runToolLoop после успешной записи (универсально для всех misType).
  }

  /**
   * Подменяет args.date/dayOfWeek/mode по тексту пользователя — LLM плохо считает
   * календарь и часто ошибается на день/неделю/месяц.
   *
   * Покрывает:
   *   - слово-день («во вторник», «со среды», «по пятницам», «завтра»)
   *   - «следующая неделя» / «через неделю» — неделя начиная с понедельника / +7 дней
   *   - «следующий месяц» / «через месяц» — 1-е число / +1 месяц от сегодня
   */
  private normalizeDateArgs(toolName: string, args: Record<string, any>, session: SessionData): void {
    if (!args || typeof args !== 'object') return;
    if (!DATE_AWARE_TOOLS.has(toolName)) return;

    const lastUser = [...session.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser?.content) return;
    const txt = lastUser.content;
    // get_available_slots использует targetDate, остальные — date.
    const dateField = toolName === 'get_available_slots' ? 'targetDate' : 'date';
    const otherDateField = dateField === 'date' ? 'targetDate' : 'date';

    // (1) Слово-день («во вторник», «со среды», «завтра»). Покрывает все падежи + аббревиатуры.
    const canonical = findDayWord(txt);
    if (canonical) {
      args.dayOfWeek = canonical;
      delete args.date;
      delete args.targetDate;
      if (/следующ/iu.test(txt)) args.nextWeek = true;
      this.logger.debug(`normalizeDateArgs: dayOfWeek="${canonical}"`);
      return;
    }

    // (2) «Следующая неделя» / «в начале недели» (без конкретного дня) —
    // вся неделя с понедельника.
    if (/следующ[а-яё]*\s+недел/iu.test(txt) || /начал[а-яё]*\s+недел/iu.test(txt)) {
      delete args.date;
      delete args.targetDate;
      args.dayOfWeek = 'понедельник';
      args.nextWeek = true;
      args.mode = 'week';
      this.logger.debug('normalizeDateArgs: next-week / начало недели → week from Monday');
      return;
    }

    // (2b) «В конце недели» — ближайшая пятница, режим недели.
    if (/конц[а-яё]*\s+недел/iu.test(txt)) {
      delete args.date;
      delete args.targetDate;
      args.dayOfWeek = 'пятница';
      args.mode = 'week';
      this.logger.debug('normalizeDateArgs: конец недели → nearest Friday + week mode');
      return;
    }

    // (3) «Через неделю» — +7 дней от сегодня, режим недели.
    if (/через\s+недел/iu.test(txt)) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(0, 0, 0, 0);
      const iso = toDateStr(d);
      delete args.dayOfWeek;
      delete args.nextWeek;
      delete args[otherDateField];
      args[dateField] = iso;
      args.mode = 'week';
      this.logger.debug(`normalizeDateArgs: in one week → ${iso}`);
      return;
    }

    // (4) «Следующий месяц» — 1-е число следующего месяца, режим недели.
    if (/следующ[а-яё]*\s+месяц/iu.test(txt)) {
      const d = new Date();
      d.setMonth(d.getMonth() + 1, 1);
      d.setHours(0, 0, 0, 0);
      const iso = toDateStr(d);
      delete args.dayOfWeek;
      delete args.nextWeek;
      delete args[otherDateField];
      args[dateField] = iso;
      args.mode = 'week';
      this.logger.debug(`normalizeDateArgs: next month → ${iso}`);
      return;
    }

    // (5) «Через месяц» — сегодня + 1 месяц, режим недели.
    if (/через\s+месяц/iu.test(txt)) {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      d.setHours(0, 0, 0, 0);
      const iso = toDateStr(d);
      delete args.dayOfWeek;
      delete args.nextWeek;
      delete args[otherDateField];
      args[dateField] = iso;
      args.mode = 'week';
      this.logger.debug(`normalizeDateArgs: in one month → ${iso}`);
      return;
    }
  }

  /** Удаляет запись из recentBookings по uuid (после отмены). */
  private forgetMedflexBooking(session: SessionData, uuid: string): void {
    if (!session.recentBookings) return;
    session.recentBookings = session.recentBookings.filter((b) => b.uuid !== uuid);
  }

  /**
   * Удаляет пары «assistant.function_call(<поиск>) → function(<результат>)» из
   * истории сессии и (опционально) из активного контекста LLM. Триггеры:
   *   1) показ сводки с подтверждением (book_appointment/reschedule_appointment
   *      заблокирован на confirmation_required) — пациент выбрал слот, сырые
   *      списки больше не нужны.
   *   2) успешная запись/перенос — данные о записи уже сохранены отдельно.
   */
  private compactSearchResults(session: SessionData, context?: ChatMessage[]): void {
    session.messages = compactSearchPairs(session.messages);
    if (context) {
      const compacted = compactSearchPairs(context);
      context.length = 0;
      context.push(...compacted);
    }
  }

  /**
   * Строит компактную заметку о завершённой записи. Извлекает ФИО, специальность,
   * услугу (если запись на услугу) и клинику из последнего find_doctors_and_slots
   * / find_services результата в истории. Вызывается ДО compactSearchResults,
   * чтобы поиск ещё был доступен.
   *
   * Включает ID-поля (doctorId/clinicId/specialityId/price) — нужны для повторного
   * вызова book_appointment / reschedule_appointment в той же сессии.
   */
  private buildBookingNote(session: SessionData, args: Record<string, any>, uuid: string): string {
    let doctorName = `Врач #${args.doctorId}`;
    let speciality = '';
    let serviceName = '';
    let clinicName = '';
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const m = session.messages[i];
      if (m.role !== 'function') continue;
      if (m.name !== 'find_doctors_and_slots' && m.name !== 'find_services') continue;
      try {
        const arr = JSON.parse(m.content);
        if (!Array.isArray(arr)) continue;
        const match = arr.find((r: any) => r.doctorId === args.doctorId);
        if (!match) continue;
        if (match.doctorName) doctorName = String(match.doctorName);
        if (match.speciality)  speciality  = String(match.speciality);
        if (m.name === 'find_services' && match.serviceName) {
          serviceName = String(match.serviceName);
        }
        if (match.slot?.clinicName) clinicName = String(match.slot.clinicName);
        break;
      } catch { /* ignore parse errors */ }
    }
    const dt = formatRuDateTime(String(args.startTime ?? ''));
    const parts = [dt, doctorName];
    if (speciality)  parts.push(speciality);
    if (serviceName) parts.push(serviceName);
    if (clinicName)  parts.push(clinicName);
    // ID-поля в конце — для повторных вызовов LLM (отмена/перенос).
    const idFields = [
      `uuid=${uuid}`,
      args.doctorId ? `doctorId=${args.doctorId}` : '',
      args.clinicId ? `clinicId=${args.clinicId}` : '',
      args.specialityId ? `specialityId=${args.specialityId}` : '',
      args.price !== undefined ? `price=${args.price}` : '',
    ].filter(Boolean).join(', ');
    return `${BOOKING_NOTE_PREFIX}${parts.join(', ')}. ${idFields}`;
  }

  /**
   * Записывает факт успешной записи: строит заметку из ТЕКУЩЕЙ истории
   * (search-результаты ещё в session.messages — оттуда берутся ФИО/специальность/услуга/клиника)
   * и кладёт в session.completedBookingNotes. Вызывается ДО compactSearchResults.
   */
  private recordCompletedBooking(session: SessionData, args: Record<string, any>, uuid: string): void {
    if (!session.completedBookingNotes) session.completedBookingNotes = [];
    if (session.completedBookingNotes.some((n) => n.includes(uuid))) return;
    session.completedBookingNotes.push(this.buildBookingNote(session, args, uuid));
  }

  /**
   * Сворачивает session.messages до набора заметок о завершённых записях.
   * Запускается в начале sendMessage. Срабатывает только когда есть НОВЫЕ заметки
   * (по сравнению с уже свёрнутыми) — чтобы не уничтожить in-progress booking flow.
   *
   * session.patient, session.recentBookings, session.clientId — в session-state,
   * пациент данные повторно не вводит.
   */
  private foldCompletedBookings(session: SessionData): void {
    const notes = session.completedBookingNotes ?? [];
    const folded = session.foldedNotesCount ?? 0;
    if (notes.length <= folded) return;
    session.messages = notes.map((content) => ({ role: 'assistant' as const, content }));
    session.foldedNotesCount = notes.length;
  }

  /** Сохраняет использование токенов в БД (fire-and-forget, не блокирует ответ). */
  private saveUsage(usage: LlmUsage | undefined, sessionId: string, clinicNetId: number | undefined, provider: string): void {
    if (!usage) return;
    this.tokenUsageRepo.save({
      clinicNetId: clinicNetId ?? null,
      sessionId,
      provider,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    }).catch((err) => this.logger.warn(`Failed to save token usage: ${String(err)}`));
  }

  private cleanExpiredSessions(): void {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (now - session.updatedAt.getTime() > this.SESSION_TTL_MS) {
        this.sessions.delete(id);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.log(`Cleaned ${removed} expired chat sessions`);
    }
  }
}

/**
 * Расшифровывает данные пациента, зашифрованные по схеме RSA-OAEP + AES-256-GCM.
 * Приватный ключ берётся из переменной окружения PATIENT_DATA_PRIVATE_KEY.
 */
function decryptPatientData(encrypted: EncryptedPatient, privateKeyPem: string): PatientData {
  if (!privateKeyPem) throw new Error('PATIENT_DATA_PRIVATE_KEY не задан');
  // Поддерживаем как реальные переводы строк, так и экранированные \n из .env
  privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');

  // 1. Расшифровываем AES-ключ приватным RSA-ключом
  const encryptedAesKey = Buffer.from(encrypted.k, 'base64');
  const aesKey = crypto.privateDecrypt(
    { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    encryptedAesKey,
  );

  // 2. Расшифровываем данные через AES-256-GCM
  const iv = Buffer.from(encrypted.iv, 'base64');
  const encryptedWithTag = Buffer.from(encrypted.d, 'base64');
  const authTag = encryptedWithTag.subarray(encryptedWithTag.length - 16);
  const ciphertext = encryptedWithTag.subarray(0, encryptedWithTag.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as PatientData;
}
