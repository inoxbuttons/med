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
const DAY_NAMES = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const SPECIALITY_TTL_MS = 60 * 60 * 1000;
const LPU_TTL_MS = 10 * 60 * 1000;
let MedflexService = MedflexService_1 = class MedflexService {
    constructor() {
        this.logger = new common_1.Logger(MedflexService_1.name);
        this.specialityCache = new Map();
        this.lpuCache = new Map();
    }
    getTools() {
        return [
            {
                name: 'get_clinics',
                description: 'Возвращает список клиник сети. Вызывай когда нужно узнать ID клиники или предложить выбор.',
                parameters: { type: 'object', properties: {}, required: [] },
            },
            {
                name: 'find_doctors',
                description: 'Находит врачей по специальности или фамилии. ' +
                    'Возвращает список с id, name, speciality, specialityId, price, clinics. ' +
                    'specialityId нужен при записи (book_appointment). ' +
                    'Если пользователь называет фамилию — передавай её в поле speciality.',
                parameters: {
                    type: 'object',
                    properties: {
                        speciality: { type: 'string', description: 'Специальность или фамилия, например "терапевт", "Иванова"' },
                        clinicId: { type: 'number', description: 'ID клиники (lpu_id) для фильтрации (необязательно)' },
                    },
                    required: ['speciality'],
                },
            },
            {
                name: 'get_available_slots',
                description: 'Возвращает свободные слоты для записи к врачу. ' +
                    'СТОП — doctorId и clinicId ОБЯЗАТЕЛЬНО должны быть получены из предыдущего вызова find_doctors. ' +
                    'НИКОГДА не передавай doctorId/clinicId, если не вызывал find_doctors в этой сессии. ' +
                    'Каждый слот содержит date, dayName, clinicId, clinicName, times (массив), dtSlots (массив объектов с dt_start/dt_end). ' +
                    'dtSlots нужен для book_appointment (startTime и endTime). ' +
                    'Режимы: nearest — ближайший день со слотами (по умолчанию); ' +
                    'day — конкретная дата (передавай targetDate или dayOfWeek); ' +
                    'week — неделя от targetDate. ' +
                    'Для режима nearest НЕ передавай targetDate — сервер найдёт ближайший день сам.',
                parameters: {
                    type: 'object',
                    properties: {
                        doctorId: { type: 'number', description: 'ID врача — ТОЛЬКО из результата find_doctors, не придумывай' },
                        clinicId: { type: 'number', description: 'ID клиники (lpu_id) — ТОЛЬКО из результата find_doctors, не придумывай' },
                        mode: {
                            type: 'string',
                            enum: ['nearest', 'day', 'week'],
                            description: 'nearest — ближайшее окно, day — конкретный день, week — неделя',
                        },
                        targetDate: { type: 'string', description: 'Дата YYYY-MM-DD (для режима day или week). Не передавай для nearest.' },
                        dayOfWeek: { type: 'string', description: 'День недели или относительная дата ("завтра", "послезавтра", "понедельник" и т.п.) — сервер вычислит дату' },
                        nextWeek: { type: 'boolean', description: 'true — если пациент сказал "следующей недели"' },
                    },
                    required: ['doctorId', 'clinicId'],
                },
            },
            {
                name: 'book_appointment',
                description: 'Записывает пациента к врачу. ' +
                    'СТОП — НЕ вызывай пока пациент не произнёс явное подтверждение: "да", "подтверждаю", "записывайте". ' +
                    'Перед записью выведи сводку (врач, дата, время, клиника, стоимость) и спроси "Подтверждаете запись?". ' +
                    'startTime и endTime берутся из поля dtSlots результата get_available_slots (dt_start и dt_end). ' +
                    'specialityId берётся из результата find_doctors. ' +
                    'price берётся из результата find_doctors (поле price). ' +
                    'Для записи ОБЯЗАТЕЛЬНО нужны данные пациента — спроси их перед подтверждением если не известны.',
                parameters: {
                    type: 'object',
                    properties: {
                        doctorId: { type: 'number', description: 'ID врача' },
                        clinicId: { type: 'number', description: 'ID клиники (lpu_id)' },
                        specialityId: { type: 'number', description: 'ID специальности из find_doctors' },
                        startTime: { type: 'string', description: 'Начало приёма из dtSlots.dt_start, формат "YYYY-MM-DD HH:MM"' },
                        endTime: { type: 'string', description: 'Конец приёма из dtSlots.dt_end, формат "YYYY-MM-DD HH:MM"' },
                        price: { type: 'number', description: 'Стоимость приёма из find_doctors' },
                        firstName: { type: 'string', description: 'Имя пациента' },
                        lastName: { type: 'string', description: 'Фамилия пациента' },
                        secondName: { type: 'string', description: 'Отчество пациента (пустая строка если нет)' },
                        phone: { type: 'string', description: 'Телефон пациента: 79001234567 (11 цифр без пробелов и знаков)' },
                        birthday: { type: 'string', description: 'Дата рождения пациента YYYY-MM-DD' },
                        comment: { type: 'string', description: 'Комментарий к записи (необязательно)' },
                    },
                    required: ['doctorId', 'clinicId', 'specialityId', 'startTime', 'endTime', 'price', 'firstName', 'lastName', 'phone', 'birthday'],
                },
            },
            {
                name: 'cancel_appointment',
                description: 'Отменяет запись пациента. Вызывай ТОЛЬКО после явного подтверждения отмены. ' +
                    'ID записи (uuid) берётся из результата get_patient_appointments.',
                parameters: {
                    type: 'object',
                    properties: {
                        uuid: { type: 'string', description: 'UUID записи из get_patient_appointments' },
                    },
                    required: ['uuid'],
                },
            },
            {
                name: 'get_patient_appointments',
                description: 'Возвращает предстоящие и прошедшие записи пациента по номеру телефона. ' +
                    'ОБЯЗАТЕЛЬНО вызывай когда пациент говорит "мои записи", "покажи записи", "когда я записан" и т.п. ' +
                    'Если телефон пациента неизвестен — спроси его.',
                parameters: {
                    type: 'object',
                    properties: {
                        phone: { type: 'string', description: 'Телефон пациента: 79001234567' },
                    },
                    required: ['phone'],
                },
            },
        ];
    }
    async executeTool(name, args, clientId, apiKey, lpuGroupId, townId, districtId, patient) {
        if (!apiKey) {
            this.logger.warn(`MedFlex tool '${name}' called without API key`);
            return { error: 'Ключ интеграции MedFlex не настроен. Обратитесь к администратору.' };
        }
        if (!lpuGroupId) {
            this.logger.warn(`MedFlex tool '${name}' called without lpuGroupId`);
            return { error: 'Идентификатор сети клиник не задан.' };
        }
        const client = new medflex_client_1.MedflexClient(apiKey);
        try {
            switch (name) {
                case 'get_clinics':
                    return this.getClinics(client, lpuGroupId, townId);
                case 'find_doctors':
                    return this.findDoctors(client, args.speciality, lpuGroupId, args.clinicId, townId);
                case 'find_services':
                    return [];
                case 'get_available_slots': {
                    let targetDate = args.targetDate;
                    if (args.dayOfWeek && !targetDate) {
                        targetDate = resolveRelativeOrWeekday(args.dayOfWeek, args.nextWeek ? 1 : 0) ?? undefined;
                    }
                    return this.getAvailableSlots(client, {
                        doctorId: args.doctorId,
                        clinicId: args.clinicId,
                        lpuGroupId,
                        mode: args.mode ?? 'nearest',
                        targetDate,
                        townId,
                    });
                }
                case 'find_doctors_and_slots': {
                    let targetDate = args.date;
                    if (args.dayOfWeek && !targetDate) {
                        targetDate = resolveRelativeOrWeekday(args.dayOfWeek, args.nextWeek ? 1 : 0) ?? undefined;
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
                        if (!bookArgs.firstName)
                            bookArgs.firstName = patient.firstName;
                        if (!bookArgs.lastName)
                            bookArgs.lastName = patient.lastName;
                        if (!bookArgs.secondName)
                            bookArgs.secondName = patient.secondName;
                        if (!bookArgs.phone)
                            bookArgs.phone = patient.phone;
                        if (!bookArgs.birthday)
                            bookArgs.birthday = patient.birthday;
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
                case 'get_patient_appointments':
                    if (!args.phone)
                        return { error: 'Номер телефона не указан. Пожалуйста, попроси пациента назвать телефон.' };
                    return this.getPatientAppointments(client, args.phone, lpuGroupId);
                case 'find_patient_appointment':
                    if (!args.phone)
                        return { error: 'Номер телефона не указан.' };
                    return this.getPatientAppointments(client, args.phone, lpuGroupId);
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
        const normalizedPhone = phone.replace(/\D/g, '');
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
        const page = await client.getDoctors({
            lpuIds: lpuIds.join(','),
            specialityIds: specialityIds.length > 0 ? specialityIds.join(',') : undefined,
            size: 50,
        });
        const lpus = await this.getCachedLpus(client, lpuGroupId, townId);
        const lpuNameMap = new Map(lpus.map((l) => [l.id, l.name]));
        let doctors = page.data;
        if (doctors.length === 0 && specialityIds.length === 0) {
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
        const fromDate = targetDate ?? toDateStr(now);
        const days = mode === 'week' ? 14 : 14;
        const toDateObj = new Date(fromDate + 'T00:00:00');
        toDateObj.setDate(toDateObj.getDate() + days);
        const toDate = toDateStr(toDateObj);
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
            const d = new Date(`${date}T00:00:00`);
            const jsDay = d.getDay();
            const dbDay = jsDay === 0 ? 7 : jsDay;
            return {
                date,
                dayName: DAY_NAMES[dbDay],
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
        if (doctors.length === 0)
            return [];
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
                        slot: { date: slots[0].date, time: slots[0].times[0], clinicId: cId, clinicName: slots[0].clinicName },
                        allSlots: params.mode === 'day'
                            ? slots.flatMap((sg) => sg.times.map((t, i) => ({ date: sg.date, time: t, clinicId: cId, clinicName: sg.clinicName, dtSlot: sg.dtSlots[i] })))
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
    async bookAppointment(client, args) {
        const { doctorId, clinicId, specialityId, startTime, endTime, price } = args;
        const start = parseMfDateTime(startTime);
        if (start <= new Date()) {
            return { success: false, message: 'Нельзя записаться на прошедшее время. Пожалуйста, выберите будущий слот.' };
        }
        const phone = args.phone.replace(/\D/g, '');
        if (phone.length !== 11) {
            return { success: false, message: 'Неверный формат телефона. Укажите номер в формате 79001234567 (11 цифр).' };
        }
        const birthday = args.birthday.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
            return { success: false, message: 'Неверный формат даты рождения. Используйте формат ГГГГ-ММ-ДД.' };
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
            message: `Запись подтверждена! UUID: ${response.claim_id}. ${dateStr}. Стоимость: ${price} руб.`,
        };
    }
    async cancelAppointment(client, uuid) {
        await client.cancelAppointment(uuid);
        this.logger.log(`MedFlex appointment cancelled: ${uuid}`);
        return { success: true, message: 'Запись успешно отменена.' };
    }
    async getPatientAppointments(client, phone, lpuGroupId) {
        const normalizedPhone = phone.replace(/\D/g, '');
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
function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatRuDateTime(d) {
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]}, ${h}:${m}`;
}
function resolveRelativeOrWeekday(dayName, weekOffset = 0) {
    const s = dayName.toLowerCase().trim();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (s === 'завтра') {
        const d = new Date(today);
        d.setDate(d.getDate() + 1 + weekOffset * 7);
        return toDateStr(d);
    }
    if (s === 'послезавтра') {
        const d = new Date(today);
        d.setDate(d.getDate() + 2 + weekOffset * 7);
        return toDateStr(d);
    }
    if (s === 'сегодня') {
        return toDateStr(today);
    }
    const map = {
        понедельник: 1, вторник: 2, среда: 3, среду: 3,
        четверг: 4, пятница: 5, пятницу: 5, суббота: 6, субботу: 6, воскресенье: 0,
    };
    const target = map[s];
    if (target === undefined)
        return null;
    const current = today.getDay();
    let diff = (target - current + 7) % 7;
    if (diff === 0)
        diff = 7;
    diff += weekOffset * 7;
    const result = new Date(today);
    result.setDate(today.getDate() + diff);
    return toDateStr(result);
}
//# sourceMappingURL=medflex.service.js.map