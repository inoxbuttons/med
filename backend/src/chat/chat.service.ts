import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiService } from '../llm/openai.service';
import { GigaChatService } from '../llm/gigachat.service';
import { BookingService } from '../booking/booking.service';
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
    const promptFile = path.resolve(__dirname, '../prompts/system-prompt.txt');
    const defaultPrompt = fs.readFileSync(promptFile, 'utf-8').trim();
    this.systemPrompt = this.config.get<string>('CHAT_SYSTEM_PROMPT', defaultPrompt);
  }

  onModuleInit() {
    setInterval(() => this.cleanExpiredSessions(), 10 * 60 * 1000);
  }

  async sendMessage(dto: SendMessageDto): Promise<SendMessageResponse> {
    const { sessionId, message, provider = 'gigachat', model, clientId, clinicNetId, misType, townId, districtId, encryptedPatient } = dto;

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
    session.messages.push({ role: 'user', content: message });
    session.updatedAt = new Date();

    // Resolve pending conflict before LLM call, based on user's answer.
    // pendingConflict is only set for local DB (MedFlex/infoclinica skip checkPatientTimeConflict).
    if (session.pendingConflict) {
      const pc = session.pendingConflict;
      if (/замени|заменить|замените|заменяй/i.test(message)) {
        session.pendingConflict = undefined;
        session.state = 'idle';
        let rescheduleResult: unknown;
        if (!session.misType) {
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
        } else {
          // External MIS: delegate both steps through executeTool
          // MedFlex cancel uses { uuid }, infoclinica uses { id }
          const cancelArgs = session.misType === 'medflex'
            ? { uuid: String(pc.oldId) }
            : { id: pc.oldId, type: pc.oldType };
          await this.booking.executeTool('cancel_appointment', cancelArgs, sessionId, session.clientId, session.misType, session.clinicNetId, session.townId, session.districtId, session.patient);
          rescheduleResult = await this.booking.executeTool('book_appointment', { doctorId: pc.newDoctorId, serviceId: pc.newServiceId, clinicId: pc.newClinicId, startTime: pc.newStartTime }, sessionId, session.clientId, session.misType, session.clinicNetId, session.townId, session.districtId, session.patient);
        }
        // GigaChat-Pro requires assistant function_call before every function result
        session.messages.push({ role: 'assistant', content: '', function_call: { name: 'reschedule_appointment', arguments: JSON.stringify({ oldId: pc.oldId, type: pc.oldType, newStartTime: pc.newStartTime }) } });
        session.messages.push({ role: 'function', name: 'reschedule_appointment', content: JSON.stringify(rescheduleResult) });
      } else if (/оставить|оставь|оставьте|оставим|оставляем|обе|оба|не замен/i.test(message)) {
        session.pendingConflict = undefined;
        session.state = 'idle';
        const bookResult = await this.booking.executeTool(
          'book_appointment',
          {
            doctorId: pc.newDoctorId,
            serviceId: pc.newServiceId,
            clinicId: pc.newClinicId,
            startTime: pc.newStartTime,
          },
          sessionId,
          session.clientId,
          session.misType ?? undefined,
          session.clinicNetId,
          session.townId,
          session.districtId,
          session.patient,
        );
        // GigaChat-Pro requires assistant function_call before every function result
        session.messages.push({ role: 'assistant', content: '', function_call: { name: 'book_appointment', arguments: JSON.stringify({ doctorId: pc.newDoctorId, clinicId: pc.newClinicId, startTime: pc.newStartTime }) } });
        session.messages.push({ role: 'function', name: 'book_appointment', content: JSON.stringify(bookResult) });
      }
    }

    const tools = this.booking.getTools(session.misType ?? undefined);

    // Build full context with system prompt prepended
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let systemWithDate = `${this.systemPrompt}\nСегодняшняя дата: ${todayStr}. При указании дат всегда используй формат YYYY-MM-DD с текущим годом.`;

    // Rec 6+7: merge conflict state into the system prompt (GigaChat requires system to be first message only)
    if (session.state === 'conflict_resolution' && session.pendingConflict) {
      const pc = session.pendingConflict;
      systemWithDate +=
        `\n\nТЕКУЩЕЕ СОСТОЯНИЕ: режим разрешения конфликта.` +
        ` Существующая запись: ${pc.oldId} (тип: ${pc.oldType}), новое время: ${pc.newStartTime}.` +
        ` Ожидается ответ пациента: "оставить обе записи" или "заменить старую".` +
        ` НЕ предлагай новых записей. НЕ вызывай инструменты.`;
    }

    let reply: string;
    try {
      // Symptom shortcut only for local DB / infoclinica — for MedFlex the tool loop
      // handles symptoms via find_doctors with real specialities from the API
      if (isSymptomMessage(message) && session.misType !== 'medflex') {
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
              reason: 'confirmation_required',
            }),
          };
          context.push(blockMsg);
          session.messages.push(blockMsg);
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
            const textResult =
              session.provider === 'gigachat'
                ? await this.gigaChat.complete(context, tools, session.model, true)
                : await this.openAi.complete(context, tools, session.model);
            return textResult.type === 'text' ? textResult.content : 'Уточните ваш выбор.';
          }
        }
      }

      // Execute tool
      const toolResult = await this.booking.executeTool(result.toolName, result.toolArgs, sessionId, session.clientId, session.misType ?? undefined, session.clinicNetId, session.townId, session.districtId, session.patient);

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
        state: 'idle',
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
