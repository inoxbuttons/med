"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MedflexService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedflexService = void 0;
const common_1 = require("@nestjs/common");
const medflex_client_1 = require("./medflex.client");
const date_utils_1 = require("../shared/date-utils");
const phone_utils_1 = require("../shared/phone-utils");
const patient_data_utils_1 = require("../shared/patient-data-utils");
const SPECIALITY_TTL_MS = 60 * 60 * 1000;
const LPU_TTL_MS = 10 * 60 * 1000;
let MedflexService = MedflexService_1 = class MedflexService {
    constructor() {
        this.logger = new common_1.Logger(MedflexService_1.name);
        this.specialityCache = new Map();
        this.lpuCache = new Map();
    }
    getTools(hasPatient) {
        const tools = [
            {
                name: 'get_clinics',
                description: 'Список клиник сети.',
                parameters: { type: 'object', properties: {}, required: [] },
            },
            {
                name: 'find_doctors',
                description: 'Поиск врачей по специальности или фамилии (поле speciality). ' +
                    'Возвращает id, name, speciality, specialityId, price, clinics. ' +
                    'specialityId нужен для book_appointment.',
                parameters: {
                    type: 'object',
                    properties: {
                        speciality: { type: 'string', description: 'Специальность или фамилия ("терапевт", "Иванова")' },
                        clinicId: { type: 'number', description: 'ID клиники (lpu_id), опционально' },
                    },
                    required: ['speciality'],
                },
            },
            {
                name: 'find_doctors_and_slots',
                description: 'Поиск врачей по СПЕЦИАЛЬНОСТИ или ФАМИЛИИ + ближайшие слоты. Используй для "к терапевту", "к Ивановой". ' +
                    'НЕ используй для конкретных процедур ("УЗИ сердца", "пилинг") — для них find_services. ' +
                    'Возвращает doctorId, doctorName, speciality, specialityId, price, slot{date,time,clinicId,clinicName}; при mode=day также allSlots. ' +
                    'Для слов "вторник"/"завтра" используй dayOfWeek, НЕ date.',
                parameters: {
                    type: 'object',
                    properties: {
                        speciality: { type: 'string', description: 'Специальность или фамилия' },
                        clinicId: { type: 'number', description: 'ID клиники, опционально' },
                        date: { type: 'string', description: 'YYYY-MM-DD — только для явных дат с числом' },
                        dayOfWeek: { type: 'string', description: '"понедельник"…"воскресенье" / "сегодня"/"завтра"/"послезавтра"' },
                        nextWeek: { type: 'boolean', description: 'true для "следующей недели"' },
                        mode: {
                            type: 'string',
                            enum: ['nearest', 'day', 'week'],
                            description: 'nearest (по умолч.) / day / week',
                        },
                    },
                    required: ['speciality'],
                },
            },
            {
                name: 'find_services',
                description: 'Поиск медицинской УСЛУГИ (процедуры, исследования) по названию: "УЗИ сердца", "пилинг", "ботокс", "чистка лица". ' +
                    'Используй ВМЕСТО find_doctors_and_slots, когда пациент называет процедуру/исследование, а не специальность врача. ' +
                    'Если пациент назвал день («в субботу», «завтра», «на следующей неделе») — передавай dayOfWeek/nextWeek/date, иначе вернётся ближайший слот. ' +
                    'Возвращает: serviceId, serviceName, duration, price (цена услуги), doctorId, doctorName, speciality, specialityId, slot{date,time,clinicId,clinicName}. ' +
                    'Для записи в book_appointment передавай specialityId (специальность врача из этого результата) и price (цена услуги).',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Название услуги или часть ("УЗИ сердца", "пилинг")' },
                        clinicId: { type: 'number', description: 'ID клиники, опционально' },
                        dayOfWeek: { type: 'string', description: '"понедельник"…"воскресенье" / "сегодня"/"завтра"/"послезавтра"' },
                        nextWeek: { type: 'boolean', description: 'true для «следующей недели»' },
                        date: { type: 'string', description: 'YYYY-MM-DD — только для явных дат с числом' },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'get_available_slots',
                description: 'Слоты конкретного врача (doctorId уже известен). Если только специальность — используй find_doctors_and_slots. ' +
                    'doctorId/clinicId бери ТОЛЬКО из find_doctors. ' +
                    'Возвращает date, dateLabel ("Сегодня"/"Завтра"/"Послезавтра"/"Вторник, 26 мая"), clinicId, clinicName, times, dtSlots (нужен для startTime/endTime в book_appointment). ' +
                    'Режимы: nearest (по умолч., ≤5 ближайших) / day (ВСЕ слоты конкретной даты — используй когда пациент назвал конкретное время или хочет видеть весь день) / week.',
                parameters: {
                    type: 'object',
                    properties: {
                        doctorId: { type: 'number', description: 'ID врача из find_doctors' },
                        clinicId: { type: 'number', description: 'ID клиники из find_doctors' },
                        mode: {
                            type: 'string',
                            enum: ['nearest', 'day', 'week'],
                            description: 'nearest / day / week',
                        },
                        targetDate: { type: 'string', description: 'YYYY-MM-DD (для day/week)' },
                        dayOfWeek: { type: 'string', description: '"понедельник"…/"завтра"/"послезавтра"' },
                        nextWeek: { type: 'boolean', description: 'true для "следующей недели"' },
                    },
                    required: ['doctorId', 'clinicId'],
                },
            },
            {
                name: 'book_appointment',
                description: 'Создаёт запись. Вызывай ТОЛЬКО после явного "да"/"подтверждаю". ' +
                    'Перед вызовом покажи сводку (врач, дата, время, клиника) и спроси "Подтверждаете запись?". ' +
                    'Стоимость в сводке НЕ упоминай, если пациент о цене не спрашивал. ' +
                    'startTime/endTime — из dtSlots. specialityId и price — из find_doctors_and_slots (для приёма врача) ИЛИ find_services (для процедуры; там price = цена услуги). ' +
                    (hasPatient
                        ? 'Данные пациента известны — не спрашивай и не передавай ФИО/телефон/дату рождения.'
                        : 'Гостевой режим (данных пациента нет): (1) спроси одним сообщением фамилию, имя, отчество, телефон, дату рождения; ' +
                            '(2) дождись ответа; (3) покажи сводку и спроси подтверждение; (4) только после "да" вызывай с РЕАЛЬНЫМИ значениями. ' +
                            'Запрещено передавать плейсхолдеры ({FIRST_NAME}, <PHONE> и т.п.) или пустые строки. ' +
                            'В сводке "Врач" — из find_doctors, НЕ имя пациента.'),
                parameters: {
                    type: 'object',
                    properties: {
                        doctorId: { type: 'number', description: 'ID врача' },
                        clinicId: { type: 'number', description: 'ID клиники' },
                        specialityId: { type: 'number', description: 'ID специальности из find_doctors_and_slots / find_services' },
                        startTime: { type: 'string', description: 'dtSlots.dt_start, "YYYY-MM-DD HH:MM"' },
                        endTime: { type: 'string', description: 'dtSlots.dt_end, "YYYY-MM-DD HH:MM"' },
                        price: { type: 'number', description: 'Цена из find_doctors_and_slots (приём) или find_services (процедура)' },
                        firstName: { type: 'string', description: 'Имя пациента' },
                        lastName: { type: 'string', description: 'Фамилия пациента' },
                        secondName: { type: 'string', description: 'Отчество (или пустая строка)' },
                        phone: { type: 'string', description: 'Телефон в любом формате (сервер нормализует)' },
                        birthday: { type: 'string', description: 'Дата рождения в любом формате ("1 января 1983", "01.01.1983")' },
                        comment: { type: 'string', description: 'Комментарий, опционально' },
                    },
                    required: hasPatient
                        ? ['doctorId', 'clinicId', 'specialityId', 'startTime', 'endTime', 'price']
                        : ['doctorId', 'clinicId', 'specialityId', 'startTime', 'endTime', 'price', 'firstName', 'lastName', 'phone', 'birthday'],
                },
            },
        ];
        if (hasPatient) {
            tools.push({
                name: 'cancel_appointment',
                description: 'Отмена записи. Вызывай только после подтверждения. uuid — из get_patient_appointments.',
                parameters: {
                    type: 'object',
                    properties: {
                        uuid: { type: 'string', description: 'UUID записи' },
                    },
                    required: ['uuid'],
                },
            }, {
                name: 'reschedule_appointment',
                description: 'Атомарный перенос: отменяет старую запись и создаёт новую за один вызов. ' +
                    'Используй для любого «перенеси/перепиши на другую дату/время». Вызывай ТОЛЬКО после явного "да"/"подтверждаю". ' +
                    'oldUuid — UUID старой записи (из истории сессии). Остальные параметры — для новой записи из find_doctors_and_slots/find_services.',
                parameters: {
                    type: 'object',
                    properties: {
                        oldUuid: { type: 'string', description: 'UUID старой записи' },
                        doctorId: { type: 'number', description: 'ID врача новой записи' },
                        clinicId: { type: 'number', description: 'ID клиники' },
                        specialityId: { type: 'number', description: 'ID специальности' },
                        startTime: { type: 'string', description: 'dtSlot.dt_start новой записи' },
                        endTime: { type: 'string', description: 'dtSlot.dt_end' },
                        price: { type: 'number', description: 'Цена' },
                    },
                    required: ['oldUuid', 'doctorId', 'clinicId', 'specialityId', 'startTime', 'endTime', 'price'],
                },
            }, {
                name: 'get_patient_appointments',
                description: 'Записи пациента по телефону. Вызывай для "мои записи", "когда я записан". ' +
                    'Если телефон неизвестен — спроси.',
                parameters: {
                    type: 'object',
                    properties: {
                        phone: { type: 'string', description: 'Телефон, 79XXXXXXXXX' },
                    },
                    required: ['phone'],
                },
            });
        }
        return tools;
    }
    async executeTool(name, args, clientId, apiKey, lpuGroupId, townId, districtId, patient) {
        let client;
        if (!apiKey) {
            const mockUrl = process.env.MEDFLEX_MOCK_URL ?? 'http://localhost:3001';
            this.logger.debug(`MedFlex tool '${name}' → mock server ${mockUrl}`);
            client = new medflex_client_1.MedflexClient('mock', mockUrl);
            if (!lpuGroupId)
                lpuGroupId = 1;
            apiKey = 'mock';
        }
        else {
            if (!lpuGroupId) {
                this.logger.warn(`MedFlex tool '${name}' called without lpuGroupId`);
                return { error: 'Идентификатор сети клиник не задан.' };
            }
            client = new medflex_client_1.MedflexClient(apiKey);
        }
        if (!patient && (name === 'get_patient_appointments' || name === 'find_patient_appointment')) {
            return { error: 'Для работы с существующими записями нужно войти в личный кабинет на сайте клиники.' };
        }
        try {
            switch (name) {
                case 'get_clinics':
                    return this.getClinics(client, lpuGroupId, townId);
                case 'find_doctors':
                    return this.findDoctors(client, args.speciality, lpuGroupId, args.clinicId, townId);
                case 'find_services': {
                    let svcTargetDate = args.date;
                    if (args.dayOfWeek) {
                        svcTargetDate = resolveRelativeOrWeekday(args.dayOfWeek, args.nextWeek ? 1 : 0) ?? svcTargetDate;
                    }
                    return this.findServices(client, {
                        query: args.query,
                        targetDate: svcTargetDate,
                        lpuGroupId,
                        clinicId: args.clinicId,
                        townId,
                    });
                }
                case 'get_available_slots': {
                    let targetDate = args.targetDate;
                    if (args.dayOfWeek) {
                        targetDate = resolveRelativeOrWeekday(args.dayOfWeek, args.nextWeek ? 1 : 0) ?? targetDate;
                    }
                    return this.getAvailableSlots(client, {
                        doctorId: args.doctorId,
                        clinicId: args.clinicId,
                        lpuGroupId,
                        mode: args.mode ?? (targetDate ? 'day' : 'nearest'),
                        targetDate,
                        townId,
                    });
                }
                case 'find_doctors_and_slots': {
                    let targetDate = args.date;
                    if (args.dayOfWeek) {
                        targetDate = resolveRelativeOrWeekday(args.dayOfWeek, args.nextWeek ? 1 : 0) ?? targetDate;
                    }
                    return this.findDoctorsAndSlots(client, {
                        speciality: args.speciality,
                        clinicId: args.clinicId,
                        lpuGroupId,
                        mode: args.mode ?? (targetDate ? 'day' : 'nearest'),
                        targetDate,
                        townId,
                    });
                }
                case 'book_appointment': {
                    const bookArgs = { ...args };
                    if (patient) {
                        bookArgs.firstName = patient.firstName;
                        bookArgs.lastName = patient.lastName;
                        bookArgs.secondName = patient.secondName;
                        bookArgs.phone = patient.phone;
                        bookArgs.birthday = patient.birthday;
                    }
                    if (!patient) {
                        const missing = [];
                        if ((0, patient_data_utils_1.isPlaceholderValue)(bookArgs.firstName))
                            missing.push('имя');
                        if ((0, patient_data_utils_1.isPlaceholderValue)(bookArgs.lastName))
                            missing.push('фамилию');
                        if ((0, patient_data_utils_1.isMissingPhone)(bookArgs.phone))
                            missing.push('телефон');
                        if ((0, patient_data_utils_1.isMissingBirthday)(bookArgs.birthday))
                            missing.push('дату рождения');
                        if (missing.length > 0) {
                            return {
                                success: false,
                                reason: 'patient_data_required',
                                message: `Данные пациента не получены (${missing.join(', ')}). ` +
                                    `НЕ вызывай book_appointment повторно с плейсхолдерами или пустыми значениями. ` +
                                    `Сначала спроси у пользователя одним сообщением: фамилию, имя, отчество, телефон и дату рождения. ` +
                                    `Только после ответа пользователя вызови book_appointment снова, подставив реальные значения.`,
                            };
                        }
                    }
                    try {
                        return await this.bookAppointment(client, bookArgs);
                    }
                    catch (bookErr) {
                        const bookErrMsg = String(bookErr.message ?? bookErr);
                        if (bookErrMsg.includes('409')) {
                            const existing = await this.findConflictingAppointment(client, bookArgs.phone, bookArgs.startTime);
                            return {
                                success: false,
                                conflict: true,
                                existingAppointment: existing,
                                pendingBookingArgs: bookArgs,
                            };
                        }
                        throw bookErr;
                    }
                }
                case 'cancel_appointment':
                    if (!args.uuid)
                        return { error: 'UUID записи не указан.' };
                    return this.cancelAppointment(client, args.uuid);
                case 'reschedule_appointment': {
                    if (!args.oldUuid)
                        return { success: false, message: 'oldUuid обязателен' };
                    if (!patient)
                        return { success: false, message: 'Данные пациента в сессии отсутствуют — нельзя перенести запись без них.' };
                    try {
                        await this.cancelAppointment(client, String(args.oldUuid));
                    }
                    catch (e) {
                        return { success: false, message: `Не удалось отменить старую запись: ${e?.message ?? e}` };
                    }
                    const bookArgs = {
                        doctorId: args.doctorId,
                        clinicId: args.clinicId,
                        specialityId: args.specialityId,
                        startTime: args.startTime,
                        endTime: args.endTime,
                        price: args.price,
                        firstName: patient.firstName,
                        lastName: patient.lastName,
                        secondName: patient.secondName ?? '',
                        phone: patient.phone,
                        birthday: patient.birthday,
                    };
                    try {
                        const bookResult = await this.bookAppointment(client, bookArgs);
                        return { ...bookResult, oldCanceled: true };
                    }
                    catch (e) {
                        return {
                            success: false,
                            message: 'Старая запись отменена, но создать новую не удалось. Попробуйте записаться снова.',
                            oldCanceled: true,
                            bookError: String(e?.message ?? e),
                        };
                    }
                }
                case 'get_patient_appointments': {
                    const phone = args.phone ?? patient?.phone;
                    if (!phone)
                        return { error: 'Номер телефона не указан. Пожалуйста, попроси пациента назвать телефон.' };
                    return await this.getPatientAppointments(client, phone, lpuGroupId);
                }
                case 'find_patient_appointment': {
                    const phone = args.phone ?? patient?.phone;
                    if (!phone)
                        return { error: 'Номер телефона не указан.' };
                    return await this.getPatientAppointments(client, phone, lpuGroupId);
                }
                default:
                    return { error: `Инструмент '${name}' не поддерживается в MedFlex.` };
            }
        }
        catch (err) {
            this.logger.error(`MedFlex tool ${name} error: ${String(err)}`);
            const msg = String(err.message ?? err);
            if (msg.includes('423'))
                return { error: 'Выбранный слот уже занят. Пожалуйста, выберите другое время.' };
            if (msg.includes('400'))
                return { error: 'Запись не удалась. Возможно, слот недоступен. Уточните данные и попробуйте снова.' };
            if (msg.includes('401'))
                return { error: 'Ошибка авторизации MedFlex. Обратитесь к администратору.' };
            if (msg.includes('429'))
                return { error: 'Превышен лимит запросов. Пожалуйста, подождите минуту и повторите.' };
            return { error: `Ошибка при выполнении ${name}. Пожалуйста, уточни данные и попробуй снова.` };
        }
    }
    async findConflictingAppointment(client, phone, startTime) {
        if (!phone)
            return null;
        const normalizedPhone = (0, phone_utils_1.normalizeRuPhone)(phone);
        if (!normalizedPhone)
            return null;
        const date = startTime.slice(0, 10);
        try {
            const history = await client.getAppointmentHistory({
                mobilePhone: normalizedPhone,
                dateStart: date,
                dateEnd: date,
                size: 10,
            });
            const active = history.data.filter((a) => !a.canceled);
            if (active.length === 0)
                return null;
            const a = active[0];
            return {
                uuid: a.uuid,
                description: `${a.date} в ${a.time_start.slice(0, 5)} у ${a.doctor.fio} в ${a.lpu.name}`,
            };
        }
        catch (err) {
            this.logger.warn(`Could not fetch conflicting appointment: ${String(err)}`);
            return null;
        }
    }
    async getCachedSpecialities(client, apiKey) {
        const cached = this.specialityCache.get(apiKey);
        if (cached && Date.now() - cached.fetchedAt < SPECIALITY_TTL_MS) {
            return cached.data;
        }
        this.logger.log('Fetching MedFlex specialities...');
        const data = await client.getSpecialities();
        this.specialityCache.set(apiKey, { data, fetchedAt: Date.now() });
        this.logger.log(`MedFlex specialities cached: ${data.length}`);
        return data;
    }
    async resolveSpecialities(query, client, apiKey) {
        const all = await this.getCachedSpecialities(client, apiKey);
        const q = query.toLowerCase().trim();
        const SYNONYMS = {
            'лор': 'оторинол',
            'лор-врач': 'оторинол',
            'отоларинголог': 'оторинол',
            'ухо-горло-нос': 'оторинол',
            'ухогорлонос': 'оторинол',
            'глазной': 'офтальм',
            'окулист': 'офтальм',
            'кожный': 'дермат',
            'кожник': 'дермат',
            'женский': 'гинеколог',
            'женский врач': 'гинеколог',
            'мужской': 'уролог',
            'простатит': 'уролог',
            'сердечный': 'кардиолог',
            'кардио': 'кардиолог',
            'желудок': 'гастро',
            'жкт': 'гастро',
            'сахарный диабет': 'эндокринолог',
            'щитовидка': 'эндокринолог',
            'нервы': 'невролог',
            'голова': 'невролог',
            'позвоночник': 'травматолог',
            'спина': 'невролог',
            'аллергия': 'аллерголог',
            'крови': 'гематолог',
            'почки': 'нефролог',
            'грудь': 'маммолог',
            'геморрой': 'проктолог',
            'узи': 'узи',
            'хирург': 'хирург',
        };
        const expanded = SYNONYMS[q] ?? null;
        if (expanded) {
            const synMatches = all.filter((s) => s.name.toLowerCase().includes(expanded));
            if (synMatches.length > 0)
                return synMatches;
        }
        const matches = all.filter((s) => s.name.toLowerCase().includes(q));
        if (matches.length > 0)
            return matches;
        const firstWord = q.split(' ')[0];
        return all.filter((s) => s.name.toLowerCase().includes(firstWord));
    }
    async getCachedLpus(client, lpuGroupId, townId) {
        const cached = this.lpuCache.get(lpuGroupId);
        if (cached && Date.now() - cached.fetchedAt < LPU_TTL_MS) {
            return cached.lpus;
        }
        this.logger.log(`Fetching MedFlex LPUs for group ${lpuGroupId}...`);
        const lpus = await client.getAllLpus(lpuGroupId, townId);
        this.lpuCache.set(lpuGroupId, { lpus, fetchedAt: Date.now() });
        this.logger.log(`MedFlex LPUs cached for group ${lpuGroupId}: ${lpus.length}`);
        return lpus;
    }
    async getClinics(client, lpuGroupId, townId) {
        const lpus = await this.getCachedLpus(client, lpuGroupId, townId);
        return lpus
            .filter((l) => l.is_visible && l.direct_appointment_is_supported)
            .map((l) => ({
            id: l.id,
            name: l.name,
            address: l.address,
            phone: l.phone ?? null,
        }));
    }
    async findDoctors(client, speciality, lpuGroupId, clinicId, townId) {
        const apiKey = client.apiKey;
        const matchedSpecs = await this.resolveSpecialities(speciality, client, apiKey);
        const specialityIds = matchedSpecs.map((s) => s.id);
        let lpuIds;
        if (clinicId) {
            lpuIds = [clinicId];
        }
        else {
            const lpus = await this.getCachedLpus(client, lpuGroupId, townId);
            lpuIds = lpus.filter((l) => l.direct_appointment_is_supported).map((l) => l.id);
        }
        if (lpuIds.length === 0)
            return [];
        const lpus = await this.getCachedLpus(client, lpuGroupId, townId);
        const lpuNameMap = new Map(lpus.map((l) => [l.id, l.name]));
        let doctors;
        if (specialityIds.length > 0) {
            const page = await client.getDoctors({
                lpuIds: lpuIds.join(','),
                specialityIds: specialityIds.join(','),
                size: 50,
            });
            doctors = page.data;
        }
        else {
            const allPage = await client.getDoctors({ lpuIds: lpuIds.join(','), size: 50 });
            const q = speciality.toLowerCase();
            doctors = allPage.data.filter((d) => d.efio.toLowerCase().includes(q));
        }
        return doctors.map((d) => {
            const matchedSpecId = d.specialities.find((sid) => specialityIds.includes(sid)) ?? d.specialities[0] ?? null;
            const matchedSpecName = matchedSpecId
                ? (matchedSpecs.find((s) => s.id === matchedSpecId)?.name ?? `Специальность #${matchedSpecId}`)
                : speciality;
            const priceForSpec = d.prices?.find((p) => p.speciality_id === matchedSpecId);
            const price = priceForSpec?.price ?? null;
            const docClinicIds = d.lpus.filter((id) => lpuIds.includes(id));
            return {
                id: d.id,
                name: d.efio,
                speciality: matchedSpecName,
                specialityId: matchedSpecId,
                price: typeof price === 'number' ? price : null,
                clinics: docClinicIds.map((id) => ({ id, name: lpuNameMap.get(id) ?? `Клиника #${id}` })),
            };
        });
    }
    async getAvailableSlots(client, params) {
        const { doctorId, clinicId, mode, targetDate } = params;
        const now = new Date();
        const fromDate = targetDate ?? (0, date_utils_1.toDateStr)(now);
        const days = mode === 'week' ? 14 : 14;
        const toDateObj = new Date(fromDate + 'T00:00:00');
        toDateObj.setDate(toDateObj.getDate() + days);
        const toDate = (0, date_utils_1.toDateStr)(toDateObj);
        const [schedPage, histPage] = await Promise.all([
            client.getScheduleByLpu({
                lpuIds: String(clinicId),
                dateStart: fromDate,
                days,
            }),
            client.getAppointmentHistory({
                lpuId: clinicId,
                doctorId,
                dateStart: fromDate,
                dateEnd: toDate,
                size: 500,
            }).catch(() => ({ data: [], count: 0, num_pages: 1, links: { next: null, previous: null } })),
        ]);
        const bookedKeys = new Set(histPage.data
            .filter((h) => !h.canceled)
            .map((h) => `${h.date} ${h.time_start.slice(0, 5)}`));
        const allLpuSchedules = schedPage.data;
        const lpus = await this.getCachedLpus(client, params.lpuGroupId, params.townId);
        const clinicName = lpus.find((l) => l.id === clinicId)?.name ?? `Клиника #${clinicId}`;
        const doctorSchedules = allLpuSchedules.flatMap((lpuSched) => {
            const doc = lpuSched.schedule.find((s) => s.doctor_id === doctorId);
            if (!doc)
                return [];
            return doc.cells.map((cell) => ({ ...cell, lpu_id: lpuSched.lpu_id }));
        });
        if (doctorSchedules.length === 0)
            return [];
        const futureCells = doctorSchedules.filter((cell) => {
            const dt = parseMfDateTime(cell.dt_start);
            if (dt <= now)
                return false;
            return !bookedKeys.has(cell.dt_start.slice(0, 16));
        });
        const groups = new Map();
        for (const cell of futureCells) {
            const date = cell.dt_start.slice(0, 10);
            const time = cell.dt_start.slice(11, 16);
            if (!groups.has(date)) {
                groups.set(date, { times: [], dtSlots: [] });
            }
            groups.get(date).times.push(time);
            groups.get(date).dtSlots.push({ dt_start: cell.dt_start, dt_end: cell.dt_end });
        }
        const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
        const result = sorted.map(([date, { times, dtSlots }]) => {
            return {
                date,
                dateLabel: (0, date_utils_1.formatRuDateLabel)(date),
                clinicId,
                clinicName,
                times: mode === 'nearest' ? times.slice(0, 5) : times,
                dtSlots: mode === 'nearest' ? dtSlots.slice(0, 5) : dtSlots,
            };
        });
        if (mode === 'nearest') {
            return result.length > 0 ? [result[0]] : [];
        }
        if (mode === 'day' && targetDate) {
            return result.filter((r) => r.date === targetDate);
        }
        return result;
    }
    async findDoctorsAndSlots(client, params) {
        const doctors = await this.findDoctors(client, params.speciality, params.lpuGroupId, params.clinicId, params.townId);
        if (doctors.length === 0) {
            const svc = await this.findServices(client, {
                query: params.speciality,
                lpuGroupId: params.lpuGroupId,
                clinicId: params.clinicId,
                townId: params.townId,
                targetDate: params.targetDate,
            });
            if (svc.length > 0)
                return svc;
            return [];
        }
        const results = await Promise.all(doctors.map(async (doc) => {
            const clinicIds = doc.clinics.map((c) => c.id);
            for (const cId of clinicIds) {
                const slots = await this.getAvailableSlots(client, {
                    doctorId: doc.id,
                    clinicId: cId,
                    lpuGroupId: params.lpuGroupId,
                    mode: params.mode,
                    targetDate: params.targetDate,
                    townId: params.townId,
                });
                if (slots.length > 0 && slots[0].times.length > 0) {
                    return {
                        doctorId: doc.id,
                        doctorName: doc.name,
                        speciality: doc.speciality,
                        specialityId: doc.specialityId,
                        price: doc.price,
                        isAvailable: true,
                        slot: { date: slots[0].date, dateLabel: (0, date_utils_1.formatRuDateLabel)(slots[0].date), time: slots[0].times[0], clinicId: cId, clinicName: slots[0].clinicName },
                        allSlots: params.mode === 'day'
                            ? slots.flatMap((sg) => sg.times.map((t, i) => ({ date: sg.date, time: t, dtSlot: sg.dtSlots[i] })))
                            : undefined,
                    };
                }
            }
            return {
                doctorId: doc.id,
                doctorName: doc.name,
                speciality: doc.speciality,
                specialityId: doc.specialityId,
                price: doc.price,
                isAvailable: false,
                slot: null,
            };
        }));
        return results;
    }
    async findServices(client, params) {
        const apiKey = client.apiKey;
        let lpuIds;
        if (params.clinicId) {
            lpuIds = [params.clinicId];
        }
        else {
            const lpus = await this.getCachedLpus(client, params.lpuGroupId, params.townId);
            lpuIds = lpus.filter((l) => l.direct_appointment_is_supported).map((l) => l.id);
        }
        if (lpuIds.length === 0)
            return [];
        const q = params.query.toLowerCase().trim();
        const matched = [];
        for (const lpuId of lpuIds) {
            const list = await client.getServicePrices({ lpuId });
            for (const s of list) {
                if (s.name.toLowerCase().includes(q)) {
                    matched.push({ service: s, lpuId });
                }
            }
        }
        if (matched.length === 0)
            return [];
        const allDoctorIds = [...new Set(matched.flatMap((m) => m.service.doctor_ids))];
        if (allDoctorIds.length === 0)
            return matched.map(({ service, lpuId }) => ({
                serviceId: service.id,
                serviceName: service.name,
                duration: service.duration,
                price: service.price,
                doctorId: null,
                doctorName: null,
                speciality: '',
                specialityId: null,
                isAvailable: false,
                slot: null,
                clinicId: lpuId,
            }));
        const docPage = await client.getDoctors({
            lpuIds: lpuIds.join(','),
            doctorIds: allDoctorIds.join(','),
            size: 100,
        });
        const docMap = new Map(docPage.data.map((d) => [d.id, d]));
        const lpus = await this.getCachedLpus(client, params.lpuGroupId, params.townId);
        const lpuNameMap = new Map(lpus.map((l) => [l.id, l.name]));
        const allSpecs = await this.getCachedSpecialities(client, apiKey);
        const specMap = new Map(allSpecs.map((s) => [s.id, s.name]));
        const result = [];
        for (const { service, lpuId } of matched) {
            const lpuName = lpuNameMap.get(lpuId) ?? `Клиника #${lpuId}`;
            for (const docId of service.doctor_ids) {
                const doc = docMap.get(docId);
                if (!doc || !doc.lpus.includes(lpuId))
                    continue;
                const specialityId = doc.specialities[0] ?? null;
                const specialityName = specialityId
                    ? (specMap.get(specialityId) ?? `Специальность #${specialityId}`)
                    : '';
                const slots = await this.getAvailableSlots(client, {
                    doctorId: docId,
                    clinicId: lpuId,
                    lpuGroupId: params.lpuGroupId,
                    mode: params.targetDate ? 'day' : 'nearest',
                    targetDate: params.targetDate,
                    townId: params.townId,
                });
                const baseInfo = {
                    serviceId: service.id,
                    serviceName: service.name,
                    duration: service.duration,
                    price: service.price,
                    doctorId: docId,
                    doctorName: doc.efio,
                    speciality: specialityName,
                    specialityId,
                };
                if (slots.length > 0 && slots[0].times.length > 0) {
                    result.push({
                        ...baseInfo,
                        isAvailable: true,
                        slot: {
                            date: slots[0].date,
                            dateLabel: (0, date_utils_1.formatRuDateLabel)(slots[0].date),
                            time: slots[0].times[0],
                            clinicId: lpuId,
                            clinicName: lpuName,
                            dtSlot: slots[0].dtSlots[0],
                        },
                    });
                }
                else {
                    result.push({ ...baseInfo, isAvailable: false, slot: null, clinicId: lpuId, clinicName: lpuName });
                }
            }
        }
        return result;
    }
    async bookAppointment(client, args) {
        const { doctorId, clinicId, specialityId, startTime, endTime, price } = args;
        const start = parseMfDateTime(startTime);
        if (start <= new Date()) {
            return { success: false, message: 'Нельзя записаться на прошедшее время. Пожалуйста, выберите будущий слот.' };
        }
        const phone = (0, phone_utils_1.normalizeRuPhone)(args.phone);
        if (!phone) {
            return { success: false, message: 'Неверный формат телефона. Укажите мобильный номер из 10 или 11 цифр.' };
        }
        const birthday = (0, date_utils_1.parseFlexibleDate)(args.birthday);
        if (!birthday) {
            return { success: false, message: 'Не удалось распознать дату рождения. Попросите пациента уточнить дату.' };
        }
        const dtStart = mfDateTimeToIso(startTime);
        const dtEnd = mfDateTimeToIso(endTime);
        const response = await client.createAppointment({
            doctor: { id: doctorId, lpu_id: clinicId, speciality_id: specialityId },
            appointment: {
                dt_start: dtStart,
                dt_end: dtEnd,
                price,
                comment: args.comment,
            },
            client: {
                first_name: args.firstName,
                last_name: args.lastName,
                second_name: args.secondName ?? '',
                mobile_phone: phone,
                birthday,
            },
        });
        this.logger.log(`MedFlex booking created: ${response.claim_id}`);
        const dateStr = formatRuDateTime(start);
        return {
            success: true,
            appointmentId: undefined,
            uuid: response.claim_id,
            message: `Запись подтверждена! ${dateStr}.`,
        };
    }
    async cancelAppointment(client, uuid) {
        await client.cancelAppointment(uuid);
        this.logger.log(`MedFlex appointment cancelled: ${uuid}`);
        return { success: true, message: 'Запись успешно отменена.' };
    }
    async getPatientAppointments(client, phone, lpuGroupId) {
        const normalizedPhone = (0, phone_utils_1.normalizeRuPhone)(phone);
        if (!normalizedPhone) {
            throw new Error('Неверный формат телефона. Укажите мобильный номер из 10 или 11 цифр.');
        }
        const history = await client.getAppointmentHistory({
            mobilePhone: normalizedPhone,
            size: 20,
        });
        const now = new Date();
        return history.data
            .filter((a) => {
            const dt = new Date(`${a.date}T${a.time_start.slice(0, 5)}:00`);
            return dt > now;
        })
            .map((a) => ({
            uuid: a.uuid,
            type: 'doctor',
            date: a.date,
            time: a.time_start.slice(0, 5),
            clinicName: a.lpu.name,
            doctorName: a.doctor.fio,
            speciality: a.doctor.speciality_name,
            canceled: a.canceled,
            price: a.price,
        }));
    }
};
exports.MedflexService = MedflexService;
exports.MedflexService = MedflexService = MedflexService_1 = __decorate([
    (0, common_1.Injectable)()
], MedflexService);
function parseMfDateTime(s) {
    return new Date(mfDateTimeToIso(s));
}
function mfDateTimeToIso(s) {
    const norm = s.trim().replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(norm))
        return norm;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(norm))
        return norm + ':00';
    if (/^\d{4}-\d{2}-\d{2}$/.test(norm))
        return norm + 'T00:00:00';
    return norm;
}
function formatRuDateTime(d) {
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]}, ${h}:${m}`;
}
function resolveRelativeOrWeekday(dayName, weekOffset = 0) {
    const s = (0, date_utils_1.normalizeDayWord)(dayName);
    if (!s)
        return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (s === 'завтра') {
        const d = new Date(today);
        d.setDate(d.getDate() + 1 + weekOffset * 7);
        return (0, date_utils_1.toDateStr)(d);
    }
    if (s === 'послезавтра') {
        const d = new Date(today);
        d.setDate(d.getDate() + 2 + weekOffset * 7);
        return (0, date_utils_1.toDateStr)(d);
    }
    if (s === 'сегодня') {
        return (0, date_utils_1.toDateStr)(today);
    }
    return (0, date_utils_1.nextWeekdayDate)(s, weekOffset);
}
//# sourceMappingURL=medflex.service.js.map