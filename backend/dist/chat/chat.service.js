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
const patient_data_utils_1 = require("../integrations/shared/patient-data-utils");
const date_utils_1 = require("../integrations/shared/date-utils");
const openai_service_1 = require("../llm/openai.service");
const gigachat_service_1 = require("../llm/gigachat.service");
const qwen_service_1 = require("../llm/qwen.service");
const qwen3_service_1 = require("../llm/qwen3.service");
const booking_service_1 = require("../booking/booking.service");
const token_usage_entity_1 = require("../database/entities/token-usage.entity");
const MAX_TOOL_ITERATIONS = 6;
const MAX_MESSAGE_LENGTH = 2000;
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|commands?|prompts?|rules?)/i,
    /forget\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|commands?|rules?)/i,
    /disregard\s+(your|all|previous|prior)\s+(instructions?|rules?|commands?)/i,
    /override\s+(your|all|previous|prior)\s+(instructions?|rules?|commands?)/i,
    /you\s+are\s+now\s+(a\s+|an\s+)?(?!going|able|ready)/i,
    /act\s+as\s+(if\s+you\s+(are|were)\s+|a\s+|an\s+)/i,
    /pretend\s+(you\s+(are|were)|to\s+be)\s+/i,
    /new\s+(system\s+)?instructions?\s*:/i,
    /<\s*system\s*>/i,
    /\[\s*system\s*\]/i,
    /#+\s*system\s*prompt/i,
    /\/\*.*system.*\*\//i,
    /jailbreak/i,
    /dan\s+mode/i,
    /developer\s+mode/i,
];
function isPromptInjection(text) {
    return INJECTION_PATTERNS.some((re) => re.test(text));
}
const DISCOVERY_TOOLS = new Set(['find_doctors_and_slots', 'find_available_at_time', 'find_services']);
const POST_DISCOVERY_DROP = new Set(['get_clinics', 'find_services']);
const COMPACTABLE_SEARCH_TOOLS = new Set([
    'find_doctors',
    'find_doctors_and_slots',
    'find_services',
    'get_available_slots',
    'find_available_at_time',
    'get_clinics',
]);
const DATE_AWARE_TOOLS = new Set([
    'find_doctors_and_slots',
    'find_available_at_time',
    'get_available_slots',
    'find_patient_appointment',
]);
function extractValidSlotDates(msgs) {
    const dates = new Set();
    for (const m of msgs) {
        if (m.role !== 'function')
            continue;
        const name = m.name ?? '';
        if (!['find_doctors_and_slots', 'find_services', 'get_available_slots', 'find_available_at_time'].includes(name))
            continue;
        try {
            const parsed = JSON.parse(m.content);
            const arr = Array.isArray(parsed) ? parsed : (parsed?.available ?? parsed?.nearest ?? []);
            for (const r of arr) {
                if (r?.slot?.date)
                    dates.add(r.slot.date);
                if (r?.date)
                    dates.add(r.date);
                if (Array.isArray(r?.allSlots)) {
                    for (const s of r.allSlots) {
                        if (s?.date)
                            dates.add(s.date);
                        if (s?.dtSlot?.dt_start)
                            dates.add(String(s.dtSlot.dt_start).slice(0, 10));
                    }
                }
            }
        }
        catch { }
    }
    return dates;
}
function compactSearchPairs(msgs) {
    const out = [];
    for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        if (m.role === 'assistant' &&
            m.function_call &&
            COMPACTABLE_SEARCH_TOOLS.has(m.function_call.name) &&
            i + 1 < msgs.length &&
            msgs[i + 1].role === 'function' &&
            msgs[i + 1].name === m.function_call.name) {
            i++;
            continue;
        }
        out.push(m);
    }
    return out;
}
const BOOKING_NOTE_PREFIX = '[Активная запись пациента] ';
function formatRuDateTime(iso) {
    const m = iso.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (!m)
        return iso;
    return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
}
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
const EMERGENCY_PATTERNS = [
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
function isEmergencyMessage(text) {
    return EMERGENCY_PATTERNS.some((re) => re.test(text));
}
const EMERGENCY_REPLY = 'Это похоже на экстренную ситуацию. Срочно позвоните в скорую помощь: **103** ' +
    '(с мобильного — **112**). Если возможно, оставайтесь с пострадавшим до приезда ' +
    'врачей. Запись в клинике в такой ситуации не нужна — медлить нельзя.';
function extractTimeOfDay(text) {
    if (/(?<![а-яё])(утр(ом|енн)|с утр[аоу])/iu.test(text))
        return 'morning';
    if (/(?<![а-яё])(вечер(ом|н)|под вечер)/iu.test(text))
        return 'evening';
    if (/(?<![а-яё])(днём|в обед|после обеда|дневн)/iu.test(text))
        return 'afternoon';
    return null;
}
function extractTimeOfDayFromUserMessage(session) {
    const lastUser = [...session.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser?.content)
        return null;
    return extractTimeOfDay(lastUser.content);
}
function slotHour(time) {
    return parseInt(time.split(':')[0], 10);
}
function isInTimeOfDay(time, tod) {
    const h = slotHour(time);
    if (isNaN(h))
        return true;
    if (tod === 'morning')
        return h >= 6 && h < 12;
    if (tod === 'afternoon')
        return h >= 12 && h < 16;
    return h >= 16 && h < 22;
}
function filterSlotsByTimeOfDay(result, tod) {
    if (!Array.isArray(result))
        return result;
    const mapped = result.map((entry) => {
        if (!entry || typeof entry !== 'object')
            return entry;
        if (!Array.isArray(entry.allSlots)) {
            if (entry.slot && entry.slot.time && !isInTimeOfDay(entry.slot.time, tod)) {
                return null;
            }
            return entry;
        }
        const filtered = entry.allSlots.filter((s) => s?.time && isInTimeOfDay(s.time, tod));
        if (filtered.length === 0)
            return null;
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
const CLINIC_SPECIALISTS = 'Терапевт, Невролог, Кардиолог, Гастроэнтеролог, Эндокринолог, Гинеколог, ' +
    'Акушер-гинеколог, Уролог, Офтальмолог, Травматолог-ортопед, Хирург, ' +
    'Аллерголог-иммунолог, Дерматовенеролог, Оториноларинголог, ' +
    'Онколог-маммолог, Нефролог, Проктолог, Врач УЗИ';
let ChatService = ChatService_1 = class ChatService {
    constructor(config, openAi, gigaChat, qwen, qwen3, booking, tokenUsageRepo) {
        this.config = config;
        this.openAi = openAi;
        this.gigaChat = gigaChat;
        this.qwen = qwen;
        this.qwen3 = qwen3;
        this.booking = booking;
        this.tokenUsageRepo = tokenUsageRepo;
        this.logger = new common_1.Logger(ChatService_1.name);
        this.sessions = new Map();
        this.SESSION_TTL_MS = 30 * 60 * 1000;
        const promptFile = path.resolve(__dirname, '../prompts/system-prompt.txt');
        const defaultPrompt = fs.readFileSync(promptFile, 'utf-8').trim();
        this.systemPrompt = this.config.get('CHAT_SYSTEM_PROMPT', defaultPrompt);
        this.defaultProvider = this.config.get('CHAT_DEFAULT_PROVIDER') ?? 'gigachat';
    }
    async callLlm(provider, context, tools, model, forceText) {
        switch (provider) {
            case 'gigachat':
                return this.gigaChat.complete(context, tools, model, forceText);
            case 'qwen':
                return this.qwen.complete(context, tools, model, forceText);
            case 'qwen3':
                return this.qwen3.complete(context, tools, model, forceText);
            case 'openai':
            default:
                return this.openAi.complete(context, forceText ? [] : tools, model);
        }
    }
    onModuleInit() {
        setInterval(() => this.cleanExpiredSessions(), 10 * 60 * 1000);
    }
    async sendMessage(dto) {
        const { sessionId, message, provider = this.defaultProvider, model, clientId, clinicNetId, misType, townId, districtId, encryptedPatient } = dto;
        if (!message || typeof message !== 'string') {
            return { sessionId, reply: 'Сообщение не может быть пустым.', history: [] };
        }
        if (message.length > MAX_MESSAGE_LENGTH) {
            return { sessionId, reply: 'Сообщение слишком длинное. Пожалуйста, сократите запрос.', history: [] };
        }
        if (isPromptInjection(message)) {
            this.logger.warn(`Prompt injection attempt in session ${sessionId}: "${message.slice(0, 100)}"`);
            return { sessionId, reply: 'Я могу помочь только с записью в клинику. Чем могу быть полезен?', history: [] };
        }
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
        this.foldCompletedBookings(session);
        session.messages.push({ role: 'user', content: message });
        session.updatedAt = new Date();
        if (session.pendingConfirmation) {
            const pcfm = session.pendingConfirmation;
            const trimmed = message.trim();
            const declined = /^\s*(нет|не\s|не,|отказ|отмен)/i.test(trimmed);
            const confirmedRe = /(?<![а-яё])(да|подтверждаю|записывайте|запишите|конечно|окей|ок)(?![а-яё])/i;
            if (!declined && confirmedRe.test(trimmed)) {
                session.pendingConfirmation = undefined;
                let toolResult;
                if (pcfm.toolName === 'reschedule_appointment' && !session.misType) {
                    toolResult = await this.booking.rescheduleAppointment({
                        oldId: pcfm.toolArgs.oldId,
                        type: pcfm.toolArgs.type,
                        doctorId: pcfm.toolArgs.doctorId,
                        serviceId: pcfm.toolArgs.serviceId,
                        clinicId: pcfm.toolArgs.clinicId,
                        newStartTime: pcfm.toolArgs.newStartTime,
                        patientId: session.clientId,
                    });
                }
                else {
                    toolResult = await this.booking.executeTool(pcfm.toolName, pcfm.toolArgs, sessionId, session.clientId, session.misType ?? undefined, session.clinicNetId, session.townId, session.districtId, session.patient);
                    if (pcfm.toolName === 'book_appointment') {
                        this.rememberMedflexBooking(session, pcfm.toolArgs, toolResult);
                    }
                    else if (pcfm.toolName === 'cancel_appointment' && pcfm.toolArgs.uuid) {
                        this.forgetMedflexBooking(session, String(pcfm.toolArgs.uuid));
                    }
                }
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
                if (toolResult?.conflict === true && pcfm.toolName === 'book_appointment') {
                    const cr = toolResult;
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
                }
                else if (toolResult?.success === true) {
                    const r = toolResult;
                    if (pcfm.toolName === 'book_appointment') {
                        if (r.uuid)
                            this.recordCompletedBooking(session, pcfm.toolArgs, r.uuid);
                        this.compactSearchResults(session);
                    }
                    else if (pcfm.toolName === 'reschedule_appointment') {
                        this.compactSearchResults(session);
                    }
                }
            }
            else {
                session.pendingConfirmation = undefined;
            }
        }
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
                    this.forgetMedflexBooking(session, pc.oldUuid);
                    const rebookArgs = pc.pendingBookingArgs ?? { doctorId: pc.newDoctorId, clinicId: pc.newClinicId, startTime: pc.newStartTime };
                    rescheduleResult = await this.booking.executeTool('book_appointment', rebookArgs, sessionId, session.clientId, session.misType, session.clinicNetId, session.townId, session.districtId, session.patient);
                    this.rememberMedflexBooking(session, rebookArgs, rescheduleResult);
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
                const keepBothArgs = pc.pendingBookingArgs ?? {
                    doctorId: pc.newDoctorId,
                    serviceId: pc.newServiceId,
                    clinicId: pc.newClinicId,
                    startTime: pc.newStartTime,
                };
                const bookResult = await this.booking.executeTool('book_appointment', keepBothArgs, sessionId, session.clientId, session.misType ?? undefined, session.clinicNetId, session.townId, session.districtId, session.patient);
                this.rememberMedflexBooking(session, keepBothArgs, bookResult);
                session.messages.push({ role: 'assistant', content: '', function_call: { name: 'book_appointment', arguments: JSON.stringify({ doctorId: pc.newDoctorId, clinicId: pc.newClinicId, startTime: pc.newStartTime }) } });
                session.messages.push({ role: 'function', name: 'book_appointment', content: JSON.stringify(bookResult) });
            }
        }
        const tools = this.booking.getTools(session.misType ?? undefined, !!session.patient);
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        const todayDayName = dayNames[today.getDay()];
        let systemWithDate = `${this.systemPrompt}\nСегодня: ${todayStr} (${todayDayName}). ` +
            `Для слов "вторник"/"завтра"/"послезавтра" используй dayOfWeek; date — только для явных дат с числом.`;
        if (session.misType === 'medflex' && !session.patient) {
            systemWithDate +=
                `\n\nГОСТЕВОЙ РЕЖИМ MedFlex: операции "мои записи"/"отменить"/"перенести" недоступны — для этого пациенту нужно войти в личный кабинет клиники.`;
        }
        if (session.misType === 'medflex' && session.patient) {
            systemWithDate +=
                `\n\nДанные пациента уже в сессии — не спрашивай повторно. В book_appointment передавай только doctorId, clinicId, specialityId, startTime, endTime, price.`;
        }
        if (session.misType === 'medflex' && session.completedBookingNotes && session.completedBookingNotes.length > 0) {
            systemWithDate +=
                `\n\nЗАПИСИ ПАЦИЕНТА В ТЕКУЩЕЙ СЕССИИ:\n` +
                    session.completedBookingNotes.map((n, i) => `${i + 1}. ${n}`).join('\n') +
                    `\nДля отмены/переноса используй uuid НАПРЯМУЮ (без get_patient_appointments). ` +
                    `Если запись одна — используй её uuid без уточнений. Если несколько — выбери правильную по упомянутой пациентом специальности/врачу/услуге.`;
        }
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
            if (isEmergencyMessage(message)) {
                reply = EMERGENCY_REPLY;
            }
            else if (isSymptomMessage(message) && session.misType !== 'medflex') {
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
        const result = await this.callLlm(session.provider, context, [], session.model, true);
        this.saveUsage(result.usage, sessionId, session.clinicNetId, session.provider);
        return result.type === 'text' ? result.content : 'Пожалуйста, обратитесь к специалисту клиники.';
    }
    async runToolLoop(session, context, tools, sessionId) {
        let activeTools = session.messages.some((m) => m.role === 'function' && m.name !== undefined && DISCOVERY_TOOLS.has(m.name))
            ? tools.filter((t) => !POST_DISCOVERY_DROP.has(t.name))
            : tools;
        for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
            const isLastIteration = i === MAX_TOOL_ITERATIONS - 1;
            const result = await this.callLlm(session.provider, context, activeTools, session.model, isLastIteration);
            this.saveUsage(result.usage, sessionId, session.clinicNetId, session.provider);
            if (result.type === 'text') {
                return result.content;
            }
            this.normalizeDateArgs(result.toolName, result.toolArgs, session);
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
            if (result.toolName === 'book_appointment' || result.toolName === 'reschedule_appointment' || result.toolName === 'cancel_appointment') {
                if (result.toolName === 'book_appointment' &&
                    session.misType === 'medflex' &&
                    !session.patient) {
                    const missing = [];
                    if ((0, patient_data_utils_1.isPlaceholderValue)(result.toolArgs.firstName))
                        missing.push('имя');
                    if ((0, patient_data_utils_1.isPlaceholderValue)(result.toolArgs.lastName))
                        missing.push('фамилию');
                    if ((0, patient_data_utils_1.isMissingPhone)(result.toolArgs.phone))
                        missing.push('телефон');
                    if ((0, patient_data_utils_1.isMissingBirthday)(result.toolArgs.birthday))
                        missing.push('дату рождения');
                    if (missing.length > 0) {
                        const dataMsg = {
                            role: 'function',
                            name: result.toolName,
                            content: JSON.stringify({
                                success: false,
                                reason: 'patient_data_required',
                                message: `Данные пациента не получены (${missing.join(', ')}). ` +
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
                if (result.toolName === 'book_appointment' && typeof result.toolArgs.startTime === 'string') {
                    const validDates = extractValidSlotDates(session.messages);
                    if (validDates.size > 0) {
                        const reqDate = result.toolArgs.startTime.slice(0, 10);
                        if (!validDates.has(reqDate)) {
                            const dateMsg = {
                                role: 'function',
                                name: result.toolName,
                                content: JSON.stringify({
                                    success: false,
                                    reason: 'invalid_slot_date',
                                    message: `Дата startTime "${reqDate}" не соответствует ни одному найденному слоту. ` +
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
                const confirmed = /(?<![а-яё])(да|подтверждаю|записывайте|запишите|конечно|окей|заменить|замените|ок)(?![а-яё])/i.test(lastUserMsg.trim());
                if (!confirmed) {
                    session.pendingConfirmation = {
                        toolName: result.toolName,
                        toolArgs: { ...result.toolArgs },
                    };
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
                    this.compactSearchResults(session, context);
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
                        const textResult = await this.callLlm(session.provider, context, [], session.model, true);
                        this.saveUsage(textResult.usage, sessionId, session.clinicNetId, session.provider);
                        return textResult.type === 'text' ? textResult.content : 'Уточните ваш выбор.';
                    }
                }
            }
            const toolResult = await this.booking.executeTool(result.toolName, result.toolArgs, sessionId, session.clientId, session.misType ?? undefined, session.clinicNetId, session.townId, session.districtId, session.patient);
            if (result.toolName === 'book_appointment') {
                this.rememberMedflexBooking(session, result.toolArgs, toolResult);
            }
            else if (result.toolName === 'cancel_appointment' && result.toolArgs.uuid) {
                this.forgetMedflexBooking(session, String(result.toolArgs.uuid));
            }
            const isCompletedBooking = (result.toolName === 'book_appointment' || result.toolName === 'reschedule_appointment') &&
                toolResult?.success === true;
            if (isCompletedBooking) {
                const r = toolResult;
                if (r.uuid && result.toolName === 'book_appointment') {
                    this.recordCompletedBooking(session, result.toolArgs, r.uuid);
                }
                this.compactSearchResults(session, context);
            }
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
                const conflictTextResult = await this.callLlm(session.provider, context, [], session.model, true);
                this.saveUsage(conflictTextResult.usage, sessionId, session.clinicNetId, session.provider);
                return conflictTextResult.type === 'text' ? conflictTextResult.content : 'Уточните ваш выбор.';
            }
            let filteredResult = toolResult;
            if (result.toolName === 'find_doctors_and_slots' || result.toolName === 'find_services') {
                const tod = extractTimeOfDayFromUserMessage(session);
                if (tod)
                    filteredResult = filterSlotsByTimeOfDay(toolResult, tod);
            }
            const funcMsg = {
                role: 'function',
                name: result.toolName,
                content: JSON.stringify(filteredResult),
            };
            context.push(funcMsg);
            session.messages.push(funcMsg);
            if (DISCOVERY_TOOLS.has(result.toolName)) {
                activeTools = activeTools.filter((t) => !POST_DISCOVERY_DROP.has(t.name));
            }
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
    rememberMedflexBooking(session, args, result) {
        if (session.misType !== 'medflex')
            return;
        const r = result;
        if (!r?.success || !r.uuid)
            return;
        if (!session.patient && args.firstName && args.lastName && args.phone) {
            session.patient = {
                firstName: String(args.firstName),
                lastName: String(args.lastName),
                secondName: args.secondName ? String(args.secondName) : undefined,
                phone: String(args.phone),
                birthday: args.birthday ? String(args.birthday) : '',
            };
        }
        if (!session.recentBookings)
            session.recentBookings = [];
        if (!session.recentBookings.some((b) => b.uuid === r.uuid)) {
            session.recentBookings.push({
                uuid: r.uuid,
                description: typeof result.message === 'string' ? result.message : '',
                startTime: String(args.startTime ?? ''),
            });
        }
    }
    normalizeDateArgs(toolName, args, session) {
        if (!args || typeof args !== 'object')
            return;
        if (!DATE_AWARE_TOOLS.has(toolName))
            return;
        const lastUser = [...session.messages].reverse().find((m) => m.role === 'user');
        if (!lastUser?.content)
            return;
        const txt = lastUser.content;
        const dateField = toolName === 'get_available_slots' ? 'targetDate' : 'date';
        const otherDateField = dateField === 'date' ? 'targetDate' : 'date';
        const canonical = (0, date_utils_1.findDayWord)(txt);
        if (canonical) {
            args.dayOfWeek = canonical;
            delete args.date;
            delete args.targetDate;
            if (/следующ/iu.test(txt))
                args.nextWeek = true;
            this.logger.debug(`normalizeDateArgs: dayOfWeek="${canonical}"`);
            return;
        }
        if (/следующ[а-яё]*\s+недел/iu.test(txt) || /начал[а-яё]*\s+недел/iu.test(txt)) {
            delete args.date;
            delete args.targetDate;
            args.dayOfWeek = 'понедельник';
            args.nextWeek = true;
            args.mode = 'week';
            this.logger.debug('normalizeDateArgs: next-week / начало недели → week from Monday');
            return;
        }
        if (/конц[а-яё]*\s+недел/iu.test(txt)) {
            delete args.date;
            delete args.targetDate;
            args.dayOfWeek = 'пятница';
            args.mode = 'week';
            this.logger.debug('normalizeDateArgs: конец недели → nearest Friday + week mode');
            return;
        }
        if (/через\s+недел/iu.test(txt)) {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            d.setHours(0, 0, 0, 0);
            const iso = (0, date_utils_1.toDateStr)(d);
            delete args.dayOfWeek;
            delete args.nextWeek;
            delete args[otherDateField];
            args[dateField] = iso;
            args.mode = 'week';
            this.logger.debug(`normalizeDateArgs: in one week → ${iso}`);
            return;
        }
        if (/следующ[а-яё]*\s+месяц/iu.test(txt)) {
            const d = new Date();
            d.setMonth(d.getMonth() + 1, 1);
            d.setHours(0, 0, 0, 0);
            const iso = (0, date_utils_1.toDateStr)(d);
            delete args.dayOfWeek;
            delete args.nextWeek;
            delete args[otherDateField];
            args[dateField] = iso;
            args.mode = 'week';
            this.logger.debug(`normalizeDateArgs: next month → ${iso}`);
            return;
        }
        if (/через\s+месяц/iu.test(txt)) {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            d.setHours(0, 0, 0, 0);
            const iso = (0, date_utils_1.toDateStr)(d);
            delete args.dayOfWeek;
            delete args.nextWeek;
            delete args[otherDateField];
            args[dateField] = iso;
            args.mode = 'week';
            this.logger.debug(`normalizeDateArgs: in one month → ${iso}`);
            return;
        }
    }
    forgetMedflexBooking(session, uuid) {
        if (!session.recentBookings)
            return;
        session.recentBookings = session.recentBookings.filter((b) => b.uuid !== uuid);
    }
    compactSearchResults(session, context) {
        session.messages = compactSearchPairs(session.messages);
        if (context) {
            const compacted = compactSearchPairs(context);
            context.length = 0;
            context.push(...compacted);
        }
    }
    buildBookingNote(session, args, uuid) {
        let doctorName = `Врач #${args.doctorId}`;
        let speciality = '';
        let serviceName = '';
        let clinicName = '';
        for (let i = session.messages.length - 1; i >= 0; i--) {
            const m = session.messages[i];
            if (m.role !== 'function')
                continue;
            if (m.name !== 'find_doctors_and_slots' && m.name !== 'find_services')
                continue;
            try {
                const arr = JSON.parse(m.content);
                if (!Array.isArray(arr))
                    continue;
                const match = arr.find((r) => r.doctorId === args.doctorId);
                if (!match)
                    continue;
                if (match.doctorName)
                    doctorName = String(match.doctorName);
                if (match.speciality)
                    speciality = String(match.speciality);
                if (m.name === 'find_services' && match.serviceName) {
                    serviceName = String(match.serviceName);
                }
                if (match.slot?.clinicName)
                    clinicName = String(match.slot.clinicName);
                break;
            }
            catch { }
        }
        const dt = formatRuDateTime(String(args.startTime ?? ''));
        const parts = [dt, doctorName];
        if (speciality)
            parts.push(speciality);
        if (serviceName)
            parts.push(serviceName);
        if (clinicName)
            parts.push(clinicName);
        const idFields = [
            `uuid=${uuid}`,
            args.doctorId ? `doctorId=${args.doctorId}` : '',
            args.clinicId ? `clinicId=${args.clinicId}` : '',
            args.specialityId ? `specialityId=${args.specialityId}` : '',
            args.price !== undefined ? `price=${args.price}` : '',
        ].filter(Boolean).join(', ');
        return `${BOOKING_NOTE_PREFIX}${parts.join(', ')}. ${idFields}`;
    }
    recordCompletedBooking(session, args, uuid) {
        if (!session.completedBookingNotes)
            session.completedBookingNotes = [];
        if (session.completedBookingNotes.some((n) => n.includes(uuid)))
            return;
        session.completedBookingNotes.push(this.buildBookingNote(session, args, uuid));
    }
    foldCompletedBookings(session) {
        const notes = session.completedBookingNotes ?? [];
        const folded = session.foldedNotesCount ?? 0;
        if (notes.length <= folded)
            return;
        session.messages = notes.map((content) => ({ role: 'assistant', content }));
        session.foldedNotesCount = notes.length;
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
    __param(6, (0, typeorm_1.InjectRepository)(token_usage_entity_1.TokenUsage)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        openai_service_1.OpenAiService,
        gigachat_service_1.GigaChatService,
        qwen_service_1.QwenService,
        qwen3_service_1.Qwen3Service,
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