"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const openai_service_1 = require("../llm/openai.service");
const gigachat_service_1 = require("../llm/gigachat.service");
const booking_service_1 = require("../booking/booking.service");
const token_usage_entity_1 = require("../database/entities/token-usage.entity");
const MAX_TOOL_ITERATIONS = 10;
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
function isSymptomMessage(text) {
    return SYMPTOM_PATTERNS.some((re) => re.test(text));
}
const CLINIC_SPECIALISTS = 'Терапевт, Невролог, Кардиолог, Гастроэнтеролог, Эндокринолог, Гинеколог, ' +
    'Акушер-гинеколог, Уролог, Офтальмолог, Травматолог-ортопед, Хирург, ' +
    'Аллерголог-иммунолог, Дерматовенеролог, Оториноларинголог, ' +
    'Онколог-маммолог, Нефролог, Проктолог, Врач УЗИ';
let ChatService = ChatService_1 = class ChatService {
    constructor(config, openAi, gigaChat, booking, tokenUsageRepo) {
        this.config = config;
        this.openAi = openAi;
        this.gigaChat = gigaChat;
        this.booking = booking;
        this.tokenUsageRepo = tokenUsageRepo;
        this.logger = new common_1.Logger(ChatService_1.name);
        this.sessions = new Map();
        this.SESSION_TTL_MS = 30 * 60 * 1000;
        const promptFile = path.resolve(__dirname, '../prompts/system-prompt.txt');
        const defaultPrompt = fs.readFileSync(promptFile, 'utf-8').trim();
        this.systemPrompt = this.config.get('CHAT_SYSTEM_PROMPT', defaultPrompt);
    }
    onModuleInit() {
        setInterval(() => this.cleanExpiredSessions(), 10 * 60 * 1000);
    }
    async sendMessage(dto) {
        const { sessionId, message, provider = 'gigachat', model, clientId, clinicNetId, misType, townId, districtId, encryptedPatient } = dto;
        const session = this.getOrCreateSession(sessionId, provider, model);
        if (clientId !== undefined)
            session.clientId = clientId;
        if (clinicNetId !== undefined)
            session.clinicNetId = clinicNetId;
        if (townId !== undefined)
            session.townId = townId;
        if (districtId !== undefined)
            session.districtId = districtId;
        if (misType !== undefined && session.misType === undefined)
            session.misType = misType;
        if (encryptedPatient && !session.patient) {
            try {
                session.patient = decryptPatientData(encryptedPatient, this.config.get('PATIENT_DATA_PRIVATE_KEY', ''));
            }
            catch (err) {
                this.logger.warn(`Failed to decrypt patient data for session ${sessionId}: ${String(err)}`);
            }
        }
        session.messages.push({ role: 'user', content: message });
        session.updatedAt = new Date();
        if (session.pendingConflict) {
            const pc = session.pendingConflict;
            const wantsReplace = /замени|заменить|замените|заменяй/i.test(message);
            const wantsOtherTime = /другое время|другой|выберу|выбрать|перенесем|перенести|поменяем|поменять время/i.test(message);
            if (wantsReplace) {
                session.pendingConflict = undefined;
                session.state = 'idle';
                let rescheduleResult;
                if (session.misType === 'medflex' && pc.oldUuid) {
                    await this.booking.executeTool('cancel_appointment', { uuid: pc.oldUuid }, sessionId, session.clientId, session.misType, session.clinicNetId, session.townId, session.districtId, session.patient);
                    rescheduleResult = await this.booking.executeTool('book_appointment', pc.pendingBookingArgs ?? { doctorId: pc.newDoctorId, clinicId: pc.newClinicId, startTime: pc.newStartTime }, sessionId, session.clientId, session.misType, session.clinicNetId, session.townId, session.districtId, session.patient);
                }
                else if (session.misType && session.misType !== 'medflex') {
                    await this.booking.executeTool('cancel_appointment', { id: pc.oldId, type: pc.oldType }, sessionId, session.clientId, session.misType, session.clinicNetId, session.townId, session.districtId, session.patient);
                    rescheduleResult = await this.booking.executeTool('book_appointment', { doctorId: pc.newDoctorId, serviceId: pc.newServiceId, clinicId: pc.newClinicId, startTime: pc.newStartTime }, sessionId, session.clientId, session.misType, session.clinicNetId, session.townId, session.districtId, session.patient);
                }
                else {
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
                session.messages.push({ role: 'assistant', content: '', function_call: { name: 'reschedule_appointment', arguments: JSON.stringify({ oldId: pc.oldUuid ?? pc.oldId, newStartTime: pc.newStartTime }) } });
                session.messages.push({ role: 'function', name: 'reschedule_appointment', content: JSON.stringify(rescheduleResult) });
            }
            else if (wantsOtherTime || (session.misType === 'medflex' && /оставить|оставь|другой|нет/i.test(message))) {
                session.pendingConflict = undefined;
                session.state = 'idle';
            }
            else if (/оставить|оставь|оставьте|оставим|оставляем|обе|оба|не замен/i.test(message)) {
                session.pendingConflict = undefined;
                session.state = 'idle';
                const bookResult = await this.booking.executeTool('book_appointment', {
                    doctorId: pc.newDoctorId,
                    serviceId: pc.newServiceId,
                    clinicId: pc.newClinicId,
                    startTime: pc.newStartTime,
                }, sessionId, session.clientId, session.misType ?? undefined, session.clinicNetId, session.townId, session.districtId, session.patient);
                session.messages.push({ role: 'assistant', content: '', function_call: { name: 'book_appointment', arguments: JSON.stringify({ doctorId: pc.newDoctorId, clinicId: pc.newClinicId, startTime: pc.newStartTime }) } });
                session.messages.push({ role: 'function', name: 'book_appointment', content: JSON.stringify(bookResult) });
            }
        }
        const tools = this.booking.getTools(session.misType ?? undefined);
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        let systemWithDate = `${this.systemPrompt}\nСегодняшняя дата: ${todayStr}. При указании дат всегда используй формат YYYY-MM-DD с текущим годом.`;
        if (session.state === 'conflict_resolution' && session.pendingConflict) {
            const pc = session.pendingConflict;
            if (pc.oldUuid) {
                const desc = pc.existingDescription ?? pc.oldUuid;
                systemWithDate +=
                    `\n\nТЕКУЩЕЕ СОСТОЯНИЕ: режим разрешения конфликта MedFlex.` +
                        ` Существующая запись: ${desc}.` +
                        ` Ожидается ответ пациента: "заменить" (отменить старую и создать новую) или "выбрать другое время".` +
                        ` НЕ вызывай инструменты.`;
            }
            else {
                systemWithDate +=
                    `\n\nТЕКУЩЕЕ СОСТОЯНИЕ: режим разрешения конфликта.` +
                        ` Существующая запись: ${pc.oldId} (тип: ${pc.oldType}), новое время: ${pc.newStartTime}.` +
                        ` Ожидается ответ пациента: "оставить обе записи" или "заменить старую".` +
                        ` НЕ предлагай новых записей. НЕ вызывай инструменты.`;
            }
        }
        let reply;
        try {
            if (isSymptomMessage(message) && session.misType !== 'medflex') {
                reply = await this.handleSymptomMessage(message, systemWithDate, session, sessionId);
            }
            else {
                const context = [
                    { role: 'system', content: systemWithDate },
                    ...session.messages,
                ];
                reply = await this.runToolLoop(session, context, tools, sessionId);
            }
        }
        catch (err) {
            this.logger.error(`LLM error for session ${sessionId}: ${String(err)}`);
            throw err;
        }
        session.messages.push({ role: 'assistant', content: reply });
        session.updatedAt = new Date();
        this.logger.debug(`Session ${sessionId}: ${session.messages.length} messages`);
        return { sessionId, reply, history: [...session.messages] };
    }
    async handleSymptomMessage(message, systemPrompt, session, sessionId) {
        const symptomSystemPrompt = `Ты — медицинский ассистент клиники. ` +
            `Пациент описал жалобу. Ответь СТРОГО по шаблону (2–3 предложения): ` +
            `сначала кратко объясни возможные причины симптома (без постановки диагноза), ` +
            `затем предложи записаться к одному или двум специалистам из этого списка: ${CLINIC_SPECIALISTS}. ` +
            `Заверши вопросом "Записать вас?". Не задавай других вопросов.`;
        const context = [
            { role: 'system', content: symptomSystemPrompt },
            ...session.messages.slice(-5, -1).filter((m) => m.role === 'user' || m.role === 'assistant'),
            { role: 'user', content: message },
        ];
        const result = session.provider === 'gigachat'
            ? await this.gigaChat.complete(context, [], session.model, true)
            : await this.openAi.complete(context, [], session.model);
        this.saveUsage(result.usage, sessionId, session.clinicNetId, session.provider);
        return result.type === 'text' ? result.content : 'Пожалуйста, обратитесь к специалисту клиники.';
    }
    async runToolLoop(session, context, tools, sessionId) {
        for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
            const isLastIteration = i === MAX_TOOL_ITERATIONS - 1;
            const result = session.provider === 'gigachat'
                ? await this.gigaChat.complete(context, tools, session.model, isLastIteration)
                : await this.openAi.complete(context, tools, session.model);
            this.saveUsage(result.usage, sessionId, session.clinicNetId, session.provider);
            if (result.type === 'text') {
                return result.content;
            }
            const assistantMsg = {
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
            if (result.toolName === 'book_appointment' && session.state === 'conflict_resolution') {
                const retryBlockMsg = {
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
            if (result.toolName === 'book_appointment' || result.toolName === 'reschedule_appointment') {
                const lastUserMsg = session.messages
                    .filter((m) => m.role === 'user')
                    .slice(-1)[0]?.content ?? '';
                const confirmed = /да|подтверждаю|записывайте|запишите|конечно|окей|заменить|замените|(^|\s)ок(\s|[!.,]|$)/i.test(lastUserMsg.trim());
                if (!confirmed) {
                    const blockMsg = {
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
                if (result.toolName === 'book_appointment' && !result.toolArgs.doctorId && !result.toolArgs.serviceId) {
                    const validationMsg = {
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
                if (result.toolName === 'book_appointment' && !session.misType && session.clientId && result.toolArgs.startTime) {
                    const conflict = await this.booking.checkPatientTimeConflict(session.clientId, result.toolArgs.startTime);
                    if (conflict) {
                        session.pendingConflict = {
                            oldId: conflict.id,
                            oldType: conflict.type,
                            newDoctorId: result.toolArgs.doctorId,
                            newServiceId: result.toolArgs.serviceId,
                            newClinicId: result.toolArgs.clinicId,
                            newStartTime: result.toolArgs.startTime,
                        };
                        session.state = 'conflict_resolution';
                        const warnMsg = {
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
                        if (context[0]?.role === 'system') {
                            context[0].content +=
                                '\n\nТЕКУЩЕЕ СОСТОЯНИЕ: обнаружен конфликт записи.' +
                                    ' Объясни пациенту ситуацию (поле existingAppointment в последнем результате инструмента),' +
                                    ' спроси: оставить обе записи или заменить старую на новую? НЕ вызывай инструменты.';
                        }
                        const textResult = session.provider === 'gigachat'
                            ? await this.gigaChat.complete(context, tools, session.model, true)
                            : await this.openAi.complete(context, tools, session.model);
                        this.saveUsage(textResult.usage, sessionId, session.clinicNetId, session.provider);
                        return textResult.type === 'text' ? textResult.content : 'Уточните ваш выбор.';
                    }
                }
            }
            const toolResult = await this.booking.executeTool(result.toolName, result.toolArgs, sessionId, session.clientId, session.misType ?? undefined, session.clinicNetId, session.townId, session.districtId, session.patient);
            if (toolResult?.conflict === true && result.toolName === 'book_appointment') {
                const cr = toolResult;
                session.pendingConflict = {
                    oldId: 0,
                    oldType: 'doctor',
                    oldUuid: cr.existingAppointment?.uuid,
                    existingDescription: cr.existingAppointment?.description,
                    newDoctorId: result.toolArgs.doctorId,
                    newServiceId: result.toolArgs.serviceId,
                    newClinicId: result.toolArgs.clinicId,
                    newStartTime: result.toolArgs.startTime,
                    pendingBookingArgs: cr.pendingBookingArgs,
                };
                session.state = 'conflict_resolution';
                const conflictFuncMsg = {
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
                const conflictTextResult = session.provider === 'gigachat'
                    ? await this.gigaChat.complete(context, tools, session.model, true)
                    : await this.openAi.complete(context, tools, session.model);
                this.saveUsage(conflictTextResult.usage, sessionId, session.clinicNetId, session.provider);
                return conflictTextResult.type === 'text' ? conflictTextResult.content : 'Уточните ваш выбор.';
            }
            const funcMsg = {
                role: 'function',
                name: result.toolName,
                content: JSON.stringify(toolResult),
            };
            context.push(funcMsg);
            session.messages.push(funcMsg);
        }
        return 'Не удалось обработать запрос. Попробуйте переформулировать.';
    }
    getHistory(sessionId) {
        return this.sessions.get(sessionId)?.messages ?? [];
    }
    clearSession(sessionId) {
        this.sessions.delete(sessionId);
    }
    getOrCreateSession(sessionId, provider, model) {
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
        return this.sessions.get(sessionId);
    }
    saveUsage(usage, sessionId, clinicNetId, provider) {
        if (!usage)
            return;
        this.tokenUsageRepo.save({
            clinicNetId: clinicNetId ?? null,
            sessionId,
            provider,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
        }).catch((err) => this.logger.warn(`Failed to save token usage: ${String(err)}`));
    }
    cleanExpiredSessions() {
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
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, typeorm_1.InjectRepository)(token_usage_entity_1.TokenUsage)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        openai_service_1.OpenAiService,
        gigachat_service_1.GigaChatService,
        booking_service_1.BookingService,
        typeorm_2.Repository])
], ChatService);
function decryptPatientData(encrypted, privateKeyPem) {
    if (!privateKeyPem)
        throw new Error('PATIENT_DATA_PRIVATE_KEY не задан');
    privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');
    const encryptedAesKey = Buffer.from(encrypted.k, 'base64');
    const aesKey = crypto.privateDecrypt({ key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, encryptedAesKey);
    const iv = Buffer.from(encrypted.iv, 'base64');
    const encryptedWithTag = Buffer.from(encrypted.d, 'base64');
    const authTag = encryptedWithTag.subarray(encryptedWithTag.length - 16);
    const ciphertext = encryptedWithTag.subarray(0, encryptedWithTag.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
}
//# sourceMappingURL=chat.service.js.map