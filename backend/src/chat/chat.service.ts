import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../llm/openai.service';
import { GigaChatService } from '../llm/gigachat.service';
import { BookingService } from '../booking/booking.service';
import {
  ChatMessage,
  LlmProvider,
  PendingConflict,
  SendMessageDto,
  SendMessageResponse,
  SessionData,
} from './chat.types';

const MAX_TOOL_ITERATIONS = 10;

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
  private readonly SESSION_TTL_MS = 30 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly openAi: OpenAiService,
    private readonly gigaChat: GigaChatService,
    private readonly booking: BookingService,
  ) {
    this.systemPrompt = this.config.get<string>(
      'CHAT_SYSTEM_PROMPT',
      'Ты — помощник медицинской клиники «XXI Век». Отвечай вежливо и кратко. ' +
        'Ты помогаешь только по медицинским вопросам: запись к врачу, расписание, услуги клиники, симптомы. ' +
        'Если вопрос не связан с медициной или клиникой — вежливо ответь: ' +
        '"Я ассистент медицинского центра «XXI Век» и на такие вопросы отвечать не уполномочен. ' +
        'Могу помочь записаться к врачу или ответить на вопросы об услугах клиники." ' +
        'Никогда не придумывай информацию о расписании, клиниках или врачах. ' +
        'Для вопросов о расписании и записи используй инструменты: find_doctors, get_available_slots, find_available_at_time. ' +
        'Сценарий новой записи к врачу: ' +
        '1) вызови find_doctors со специальностью или фамилией врача; ' +
        '2) если найдено несколько врачей в разных клиниках — уточни у пациента предпочтительную клинику; ' +
        '3а) если пациент НАЗВАЛ КОНКРЕТНОЕ ВРЕМЯ (например "в 15:00", "в 9 утра", "в полдень") — ' +
        'СРАЗУ вызови find_available_at_time (без предварительного find_doctors) со speciality, date и time; ' +
        'если available содержит ОДНОГО врача — переходи к шагу 6 (сводка + подтверждение); ' +
        'если available содержит НЕСКОЛЬКО врачей — перечисли ВСЕХ (имя + клиника) и спроси у пациента кого выбрать; НЕ выбирай врача самостоятельно; ' +
        'если available пустой — покажи ближайшие слоты из nearest и предложи выбрать; ' +
        '3б) если время НЕ указано — вызови get_available_slots с doctorId и mode=day если пациент назвал дату ' +
        '(или относительную дату: завтра, послезавтра), или mode=nearest если дата не указана; ' +
        'для "завтра" передавай targetDate="завтра", для "послезавтра" — targetDate="послезавтра"; ' +
        '4) если слотов нет на запрошенную дату — сразу вызови mode=nearest и предложи ближайшую доступную дату; ' +
        '5) если слотов много — уточни предпочтительное время (утро/день/вечер) или предложи первые 3–5 вариантов; ' +
        '6) после выбора пациентом врача и/или времени — ОБЯЗАТЕЛЬНО покажи итоговую информацию (врач, специальность, дата, время, клиника) ' +
        'и задай вопрос "Подтверждаете запись?" — НЕ вызывай book_appointment до получения явного подтверждения; ' +
        'выбор врача ("Нестерова", "Шанько") — это НЕ подтверждение, после него нужна сводка и вопрос; ' +
        'имя пациента спрашивать НЕ нужно — он уже идентифицирован; ' +
        '7) только после того как пациент ответил "да", "подтверждаю", "записывайте", "конечно" — вызови book_appointment. ' +
        'Когда пациент спрашивает о своих записях ("покажи мои записи", "мои записи", "когда я записан" и т.п.) — ' +
        'ВСЕГДА вызывай инструмент get_patient_appointments без лишних вопросов. ' +
        'Когда пациент хочет отменить запись: сначала вызови find_patient_appointment с параметрами из запроса, ' +
        'покажи найденную запись пациенту и запроси подтверждение, ' +
        'только после подтверждения вызови cancel_appointment с id и type из результата. ' +
        'Когда пациент хочет перенести запись: ' +
        '1) вызови find_patient_appointment — передавай любые известные параметры: дату (date), день недели (dayOfWeek), ' +
        'время (time/timeExpression), специальность или имя врача (query); ' +
        'если пациент указал только дату — передавай только date, без query; ' +
        'инструмент ищет и среди записей к врачам и среди записей на услуги; ' +
        '2) если найдено несколько — уточни у пациента какую именно он хочет перенести; ' +
        '3) спроси пациента на какую дату/время он хочет перенести; ' +
        '4) вызови get_available_slots с doctorId и clinicId из найденной записи и mode=day для запрошенной даты — ' +
        'если слотов нет, используй mode=nearest чтобы найти ближайшую доступную дату и предложи её; ' +
        '5) когда пациент выбрал новое время — покажи полную информацию о новой записи (врач, дата, время, клиника) и запроси подтверждение; ' +
        '6) после подтверждения: вызови reschedule_appointment — передай oldId и type из find_patient_appointment, ' +
        'doctorId/serviceId и clinicId из той же записи, newStartTime новой даты и времени. ' +
        'КРИТИЧЕСКИ ВАЖНО: НИКОГДА не придумывай ID врача или клиники — используй только те ID, ' +
        'которые вернули инструменты find_doctors, find_services или get_clinics в этом разговоре. ' +
        'Если ID врача не известен из предыдущих вызовов — ОБЯЗАТЕЛЬНО вызови find_doctors заново. ' +
        'Когда показываешь результат get_available_slots с mode=nearest: ' +
        'называй дату, время И название клиники из результата; не упоминай дни в которых слотов нет.',
    );
  }

  onModuleInit() {
    setInterval(() => this.cleanExpiredSessions(), 10 * 60 * 1000);
  }

  async sendMessage(dto: SendMessageDto): Promise<SendMessageResponse> {
    const { sessionId, message, provider = 'gigachat', model, clientId, clinicNetId } = dto;

    const session = this.getOrCreateSession(sessionId, provider, model);
    // Обновляем clientId/clinicNetId если переданы (идентифицируют пользователя)
    if (clientId    !== undefined) session.clientId    = clientId;
    if (clinicNetId !== undefined) session.clinicNetId = clinicNetId;
    session.messages.push({ role: 'user', content: message });
    session.updatedAt = new Date();

    // If there's a pending conflict and user says "заменить" — resolve it before LLM call
    if (session.pendingConflict && /заменить|замените|заменяй/i.test(message)) {
      const pc = session.pendingConflict;
      session.pendingConflict = undefined;
      const rescheduleResult = await this.booking.rescheduleAppointment({
        oldId: pc.oldId,
        type: pc.oldType,
        doctorId: pc.newDoctorId,
        serviceId: pc.newServiceId,
        clinicId: pc.newClinicId,
        newStartTime: pc.newStartTime,
        patientId: session.clientId,
      });
      // Inject as function message so LLM sees the result
      session.messages.push({ role: 'function', name: 'book_appointment', content: JSON.stringify(rescheduleResult) });
    }

    const tools = this.booking.getTools();

    // Build full context with system prompt prepended
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const systemWithDate = `${this.systemPrompt}\nСегодняшняя дата: ${todayStr}. При указании дат всегда используй формат YYYY-MM-DD с текущим годом.`;

    let reply: string;
    try {
      if (isSymptomMessage(message)) {
        reply = await this.handleSymptomMessage(message, systemWithDate, session);
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
  ): Promise<string> {
    const symptomSystemPrompt =
      `Ты — медицинский ассистент клиники «XXI Век». ` +
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

    const result = session.provider === 'gigachat'
      ? await this.gigaChat.complete(context, [], session.model, true)
      : await this.openAi.complete(context, [], session.model);

    return result.type === 'text' ? result.content : 'Пожалуйста, обратитесь к специалисту клиники.';
  }

  private async runToolLoop(
    session: SessionData,
    context: ChatMessage[],
    tools: ReturnType<BookingService['getTools']>,
    sessionId: string,
  ): Promise<string> {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const isLastIteration = i === MAX_TOOL_ITERATIONS - 1;
      const result =
        session.provider === 'gigachat'
          ? await this.gigaChat.complete(context, tools, session.model, isLastIteration)
          : await this.openAi.complete(context, tools, session.model);

      if (result.type === 'text') {
        return result.content;
      }

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

      // Guard: book_appointment and reschedule_appointment require explicit confirmation
      // in the last user message of this turn
      if (result.toolName === 'book_appointment' || result.toolName === 'reschedule_appointment') {
        const lastUserMsg = session.messages
          .filter((m) => m.role === 'user')
          .slice(-1)[0]?.content ?? '';
        // Note: \b doesn't work with Cyrillic in JS — check plain substrings
        const confirmed = /да|подтверждаю|записывайте|запишите|конечно|окей|заменить|замените|(^|\s)ок(\s|[!.,]|$)/i.test(lastUserMsg.trim());
        if (!confirmed) {
          const blockMsg: ChatMessage = {
            role: 'function',
            name: result.toolName,
            content: JSON.stringify({
              success: false,
              message:
                'Запись НЕ выполнена — требуется явное подтверждение от пациента. ' +
                'Покажи итоговую информацию (врач, дата, время, клиника) и задай вопрос "Подтверждаете запись?"',
            }),
          };
          context.push(blockMsg);
          session.messages.push(blockMsg);
          continue;
        }

        // Warn if patient already has an appointment at the same time slot
        // Skip conflict check if GigaChat explicitly sets ignoreConflict=true (user confirmed keeping both)
        if (result.toolName === 'book_appointment' && session.clientId && result.toolArgs.startTime && !result.toolArgs.ignoreConflict) {
          const conflict = await this.booking.checkPatientTimeConflict(
            session.clientId,
            result.toolArgs.startTime as string,
          );
          if (conflict) {
            // Save conflict for next turn resolution, warn user
            session.pendingConflict = {
              oldId: conflict.id,
              oldType: conflict.type,
              newDoctorId: result.toolArgs.doctorId,
              newServiceId: result.toolArgs.serviceId,
              newClinicId: result.toolArgs.clinicId,
              newStartTime: result.toolArgs.startTime as string,
            } as PendingConflict;

            const warnMsg: ChatMessage = {
              role: 'function',
              name: result.toolName,
              content: JSON.stringify({
                success: false,
                conflict: true,
                message:
                  `КОНФЛИКТ: запись НЕ создана. У пациента уже есть запись: ${conflict.description}. ` +
                  `Скажи пациенту об этом и спроси: сохранить обе записи или заменить старую на новую?`,
              }),
            };
            context.push(warnMsg);
            session.messages.push(warnMsg);

            // Force text response immediately — no more tool calls
            const textResult =
              session.provider === 'gigachat'
                ? await this.gigaChat.complete(context, tools, session.model, true)
                : await this.openAi.complete(context, tools, session.model);
            return textResult.type === 'text' ? textResult.content : 'Уточните ваш выбор.';
          }
        }
      }

      // Execute tool
      const toolResult = await this.booking.executeTool(result.toolName, result.toolArgs, sessionId, session.clientId);

      // Append tool result as function message to context and session
      const funcMsg: ChatMessage = {
        role: 'function',
        name: result.toolName,
        content: JSON.stringify(toolResult),
      };
      context.push(funcMsg);
      session.messages.push(funcMsg);
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
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return this.sessions.get(sessionId)!;
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
