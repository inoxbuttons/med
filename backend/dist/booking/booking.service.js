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
var BookingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const clinic_entity_1 = require("../database/entities/clinic.entity");
const doctor_entity_1 = require("../database/entities/doctor.entity");
const doctor_location_entity_1 = require("../database/entities/doctor-location.entity");
const doctor_working_hours_entity_1 = require("../database/entities/doctor-working-hours.entity");
const doctor_exception_entity_1 = require("../database/entities/doctor-exception.entity");
const service_entity_1 = require("../database/entities/service.entity");
const service_by_clinic_entity_1 = require("../database/entities/service-by-clinic.entity");
const service_schedule_entity_1 = require("../database/entities/service-schedule.entity");
const appointment_entity_1 = require("../database/entities/appointment.entity");
const service_working_hours_entity_1 = require("../database/entities/service-working-hours.entity");
const service_exception_entity_1 = require("../database/entities/service-exception.entity");
const service_appointment_entity_1 = require("../database/entities/service-appointment.entity");
const booking_constants_1 = require("./booking.constants");
const DAY_NAMES = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
let BookingService = BookingService_1 = class BookingService {
    constructor(clinicRepo, doctorRepo, doctorLocationRepo, workingHoursRepo, exceptionRepo, serviceRepo, serviceByClinicRepo, serviceScheduleRepo, appointmentRepo, serviceWorkingHoursRepo, serviceExceptionRepo, serviceAppointmentRepo) {
        this.clinicRepo = clinicRepo;
        this.doctorRepo = doctorRepo;
        this.doctorLocationRepo = doctorLocationRepo;
        this.workingHoursRepo = workingHoursRepo;
        this.exceptionRepo = exceptionRepo;
        this.serviceRepo = serviceRepo;
        this.serviceByClinicRepo = serviceByClinicRepo;
        this.serviceScheduleRepo = serviceScheduleRepo;
        this.appointmentRepo = appointmentRepo;
        this.serviceWorkingHoursRepo = serviceWorkingHoursRepo;
        this.serviceExceptionRepo = serviceExceptionRepo;
        this.serviceAppointmentRepo = serviceAppointmentRepo;
        this.logger = new common_1.Logger(BookingService_1.name);
    }
    async getClinics() {
        const clinics = await this.clinicRepo.find({ order: { name: 'ASC' } });
        return clinics.map((c) => ({
            id: c.id,
            name: c.name,
            address: c.address,
            phone: c.phone,
        }));
    }
    async findDoctors(speciality, clinicId) {
        const qb = this.doctorRepo
            .createQueryBuilder('d')
            .innerJoinAndSelect('d.speciality', 's')
            .innerJoin('doctor_locations', 'dl', 'dl.doctor_id = d.id')
            .where('(s.name ILIKE :q OR d.name ILIKE :q)', { q: `%${speciality}%` });
        if (clinicId) {
            qb.andWhere('dl.clinic_id = :clinicId', { clinicId });
        }
        const doctors = await qb.getMany();
        if (doctors.length === 0)
            return [];
        const doctorIds = doctors.map((d) => d.id);
        const locations = await this.doctorLocationRepo
            .createQueryBuilder('dl')
            .innerJoinAndSelect('dl.clinic', 'c')
            .where('dl.doctor_id IN (:...ids)', { ids: doctorIds })
            .getMany();
        const locationsByDoctor = new Map();
        for (const loc of locations) {
            const arr = locationsByDoctor.get(loc.doctorId) ?? [];
            arr.push(loc);
            locationsByDoctor.set(loc.doctorId, arr);
        }
        return doctors.map((d) => {
            const locs = locationsByDoctor.get(d.id) ?? [];
            const price = locs.length > 0 ? Number(locs[0].price) || null : null;
            return {
                id: d.id,
                name: d.name,
                speciality: d.speciality.name,
                price,
                clinics: locs.map((l) => ({ id: l.clinicId, name: l.clinic.name })),
            };
        });
    }
    async findServices(query, clinicId) {
        const qb = this.serviceRepo
            .createQueryBuilder('s')
            .leftJoinAndSelect('s.medField', 'mf')
            .innerJoin('services_by_clinics', 'sbc', 'sbc.service_id = s.id')
            .where('s.name ILIKE :q', { q: `%${query}%` });
        if (clinicId) {
            qb.andWhere('sbc.clinic_id = :clinicId', { clinicId });
        }
        qb.limit(30);
        const services = await qb.getMany();
        if (services.length === 0)
            return [];
        const serviceIds = services.map((s) => s.id);
        const sbcs = await this.serviceByClinicRepo
            .createQueryBuilder('sbc')
            .innerJoinAndSelect('sbc.clinic', 'c')
            .where('sbc.service_id IN (:...ids)', { ids: serviceIds })
            .getMany();
        const sbcByService = new Map();
        for (const sbc of sbcs) {
            const arr = sbcByService.get(sbc.serviceId) ?? [];
            arr.push(sbc);
            sbcByService.set(sbc.serviceId, arr);
        }
        return services.map((s) => ({
            id: s.id,
            name: s.name,
            direction: s.medField?.name ?? null,
            clinics: (sbcByService.get(s.id) ?? []).map((sbc) => ({
                id: sbc.clinicId,
                name: sbc.clinic.name,
                price: Number(sbc.price) || null,
            })),
        }));
    }
    async getAvailableSlots(params) {
        const { doctorId, serviceId, clinicId } = params;
        const mode = params.mode ?? 'nearest';
        if (doctorId) {
            return this.getDoctorSlots(doctorId, clinicId, mode, params.targetDate);
        }
        return this.getServiceSlots(serviceId, clinicId, mode, params.targetDate);
    }
    async getDoctorSlots(doctorId, clinicId, mode, targetDate) {
        const whQb = this.workingHoursRepo
            .createQueryBuilder('wh')
            .innerJoinAndSelect('wh.clinic', 'c')
            .where('wh.doctor_id = :doctorId', { doctorId })
            .andWhere('wh.is_active = true');
        if (clinicId)
            whQb.andWhere('wh.clinic_id = :clinicId', { clinicId });
        const workingHours = await whQb.getMany();
        if (workingHours.length === 0)
            return [];
        const { from, days } = buildDateRange(mode, targetDate);
        const to = new Date(from);
        to.setDate(to.getDate() + days);
        const fromStr = toDateStr(from);
        const toStr = toDateStr(to);
        const exceptions = await this.exceptionRepo
            .createQueryBuilder('de')
            .where('de.doctor_id = :doctorId', { doctorId })
            .andWhere('de.date >= :from AND de.date < :to', { from: fromStr, to: toStr })
            .getMany();
        const exByDate = new Map();
        for (const ex of exceptions) {
            const arr = exByDate.get(ex.date) ?? [];
            arr.push(ex);
            exByDate.set(ex.date, arr);
        }
        const booked = await this.appointmentRepo.find({
            where: {
                doctorId,
                startTime: (0, typeorm_2.Between)(from, to),
                ...(clinicId ? { clinicId } : {}),
            },
        });
        const bookedSet = new Set(booked.map((a) => a.startTime.toISOString()));
        const now = new Date();
        const result = [];
        for (let d = 0; d < days; d++) {
            const date = new Date(from);
            date.setDate(date.getDate() + d);
            date.setHours(0, 0, 0, 0);
            const jsDay = date.getDay();
            const dbDay = jsDay === 0 ? 7 : jsDay;
            const dateStr = toDateStr(date);
            const daySchedules = workingHours.filter((wh) => wh.dayOfWeek === dbDay);
            if (daySchedules.length === 0)
                continue;
            const dayExceptions = exByDate.get(dateStr) ?? [];
            const fullDayAbsent = dayExceptions.some((ex) => ex.startTime === null);
            if (fullDayAbsent)
                continue;
            const partial = dayExceptions
                .filter((ex) => ex.startTime !== null)
                .map((ex) => ({ start: ex.startTime.slice(0, 5), end: ex.endTime.slice(0, 5) }));
            for (const sched of daySchedules) {
                const slots = generateSlots(date, sched.startTime, sched.endTime, sched.slotDuration, sched.breakStart, sched.breakEnd);
                const times = [];
                for (const slot of slots) {
                    if (slot <= now)
                        continue;
                    if (bookedSet.has(slot.toISOString()))
                        continue;
                    const t = toTimeStr(slot);
                    if (partial.some((p) => t >= p.start && t < p.end))
                        continue;
                    times.push(t);
                }
                if (times.length === 0 && mode !== 'day')
                    continue;
                result.push({
                    date: dateStr,
                    dayName: DAY_NAMES[dbDay],
                    clinicId: sched.clinicId,
                    clinicName: sched.clinic.name,
                    times: mode === 'nearest' ? times.slice(0, 5) : times,
                    ...(times.length === 0 ? { note: `Врач принимает в клинике ${sched.clinic.name} в этот день (${sched.startTime.slice(0, 5)}–${sched.endTime.slice(0, 5)}), но свободных слотов уже нет` } : {}),
                });
            }
            if (mode === 'nearest' && result.length > 0)
                break;
        }
        return result;
    }
    async getServiceSlots(serviceId, clinicId, mode, targetDate) {
        const whQb = this.serviceWorkingHoursRepo
            .createQueryBuilder('wh')
            .innerJoinAndSelect('wh.clinic', 'c')
            .where('wh.service_id = :serviceId', { serviceId })
            .andWhere('wh.is_active = true');
        if (clinicId)
            whQb.andWhere('wh.clinic_id = :clinicId', { clinicId });
        const workingHours = await whQb.getMany();
        if (workingHours.length === 0)
            return [];
        const { from, days } = buildDateRange(mode, targetDate);
        const to = new Date(from);
        to.setDate(to.getDate() + days);
        const fromStr = toDateStr(from);
        const toStr = toDateStr(to);
        const exceptions = await this.serviceExceptionRepo
            .createQueryBuilder('se')
            .where('se.service_id = :serviceId', { serviceId })
            .andWhere('se.date >= :from AND se.date < :to', { from: fromStr, to: toStr })
            .getMany();
        const exByDate = new Map();
        for (const ex of exceptions) {
            const arr = exByDate.get(ex.date) ?? [];
            arr.push(ex);
            exByDate.set(ex.date, arr);
        }
        const booked = await this.serviceAppointmentRepo.find({
            where: {
                serviceId,
                startTime: (0, typeorm_2.Between)(from, to),
                ...(clinicId ? { clinicId } : {}),
            },
        });
        const bookedSet = new Set(booked.map((a) => a.startTime.toISOString()));
        const now = new Date();
        const result = [];
        for (let d = 0; d < days; d++) {
            const date = new Date(from);
            date.setDate(date.getDate() + d);
            date.setHours(0, 0, 0, 0);
            const jsDay = date.getDay();
            const dbDay = jsDay === 0 ? 7 : jsDay;
            const dateStr = toDateStr(date);
            const daySchedules = workingHours.filter((wh) => wh.dayOfWeek === dbDay);
            if (daySchedules.length === 0)
                continue;
            const dayExceptions = exByDate.get(dateStr) ?? [];
            const fullDayAbsent = dayExceptions.some((ex) => ex.startTime === null);
            if (fullDayAbsent)
                continue;
            const partial = dayExceptions
                .filter((ex) => ex.startTime !== null)
                .map((ex) => ({ start: ex.startTime.slice(0, 5), end: ex.endTime.slice(0, 5) }));
            for (const sched of daySchedules) {
                const slots = generateSlots(date, sched.startTime, sched.endTime, sched.slotDuration, sched.breakStart, sched.breakEnd);
                const times = [];
                for (const slot of slots) {
                    if (slot <= now)
                        continue;
                    if (bookedSet.has(slot.toISOString()))
                        continue;
                    const t = toTimeStr(slot);
                    if (partial.some((p) => t >= p.start && t < p.end))
                        continue;
                    times.push(t);
                }
                if (times.length === 0 && mode !== 'day')
                    continue;
                result.push({
                    date: dateStr,
                    dayName: DAY_NAMES[dbDay],
                    clinicId: sched.clinicId,
                    clinicName: sched.clinic.name,
                    times: mode === 'nearest' ? times.slice(0, 5) : times,
                    ...(times.length === 0 ? { note: `Услуга доступна в клинике ${sched.clinic.name} в этот день (${sched.startTime.slice(0, 5)}–${sched.endTime.slice(0, 5)}), но свободных слотов уже нет` } : {}),
                });
            }
            if (mode === 'nearest' && result.length > 0)
                break;
        }
        return result;
    }
    async bookAppointment(params) {
        const { doctorId, serviceId, clinicId, patientId, source, comment } = params;
        const start = new Date(params.startTime);
        if (start <= new Date()) {
            return { success: false, message: 'Нельзя записаться на прошедшее время. Пожалуйста, выберите будущий слот.' };
        }
        let doctorName;
        if (doctorId) {
            const doctorExists = await this.doctorRepo.findOne({ where: { id: doctorId } });
            if (!doctorExists) {
                return { success: false, message: `Врач с id=${doctorId} не найден. Используй find_doctors для получения корректного ID врача.` };
            }
            doctorName = doctorExists.name;
        }
        const clinicExists = await this.clinicRepo.findOne({ where: { id: clinicId } });
        if (!clinicExists) {
            return { success: false, message: `Клиника с id=${clinicId} не найдена. Используй get_clinics для получения корректного ID клиники.` };
        }
        const clinicName = clinicExists.name;
        if (serviceId) {
            return this.bookServiceAppointment({ serviceId, clinicId, clinicName, start, patientId, source, comment });
        }
        const wh = await this.workingHoursRepo.findOne({
            where: { doctorId, clinicId, isActive: true },
        });
        const duration = wh?.slotDuration ?? booking_constants_1.SERVICE_APPOINTMENT_MINUTES;
        const end = new Date(start.getTime() + duration * 60_000);
        const conflict = await this.appointmentRepo
            .createQueryBuilder('a')
            .where('a.clinic_id = :clinicId', { clinicId })
            .andWhere('a.doctor_id = :doctorId', { doctorId })
            .andWhere('a.start_time < :end AND a.end_time > :start', { start, end })
            .getOne();
        if (conflict) {
            return { success: false, message: 'Это время уже занято. Пожалуйста, выберите другой слот.' };
        }
        const appt = this.appointmentRepo.create({
            doctorId: doctorId ?? null,
            serviceId: null,
            clinicId,
            startTime: start,
            endTime: end,
            patientId: patientId ?? null,
            source: source ?? 'ai',
            comment: comment ?? null,
        });
        const saved = await this.appointmentRepo.save(appt);
        this.logger.log(`Booked doctor appointment #${saved.id} at ${start.toISOString()}`);
        return {
            success: true,
            appointmentId: saved.id,
            message: `Запись подтверждена! ${doctorName}, ${formatRuDateTime(start)}, ${clinicName}.`,
        };
    }
    async bookServiceAppointment(params) {
        const { serviceId, clinicId, clinicName, start, patientId, source, comment } = params;
        const serviceExists = await this.serviceRepo.findOne({ where: { id: serviceId } });
        if (!serviceExists) {
            return { success: false, message: `Услуга с id=${serviceId} не найдена. Используй find_services для получения корректного ID.` };
        }
        const wh = await this.serviceWorkingHoursRepo.findOne({
            where: { serviceId, clinicId, isActive: true },
        });
        const duration = wh?.slotDuration ?? booking_constants_1.SERVICE_APPOINTMENT_MINUTES;
        const end = new Date(start.getTime() + duration * 60_000);
        const conflict = await this.serviceAppointmentRepo
            .createQueryBuilder('a')
            .where('a.clinic_id = :clinicId', { clinicId })
            .andWhere('a.service_id = :serviceId', { serviceId })
            .andWhere('a.start_time < :end AND a.end_time > :start', { start, end })
            .getOne();
        if (conflict) {
            return { success: false, message: 'Это время уже занято. Пожалуйста, выберите другой слот.' };
        }
        const appt = this.serviceAppointmentRepo.create({
            serviceId,
            clinicId,
            startTime: start,
            endTime: end,
            patientId: patientId ?? null,
            source: source ?? 'ai',
            comment: comment ?? null,
        });
        const saved = await this.serviceAppointmentRepo.save(appt);
        this.logger.log(`Booked service appointment #${saved.id} at ${start.toISOString()}`);
        return {
            success: true,
            appointmentId: saved.id,
            message: `Запись подтверждена! ${serviceExists.name}, ${formatRuDateTime(start)}, ${clinicName}.`,
        };
    }
    async resolveClinicIdByName(clinicId, clinicName) {
        if (clinicId)
            return clinicId;
        if (!clinicName)
            return undefined;
        const clinic = await this.clinicRepo.findOne({
            where: { name: (0, typeorm_2.ILike)(`%${clinicName}%`) },
        });
        return clinic ? clinic.id : undefined;
    }
    async findDoctorsAndSlots(params) {
        const resolvedClinicId = await this.resolveClinicIdByName(params.clinicId, params.clinicName);
        const doctors = await this.findDoctors(params.speciality, resolvedClinicId);
        if (doctors.length === 0)
            return [];
        const normalizedDate = params.date
            ? (resolveRelativeDate(params.date) ? toDateStr(resolveRelativeDate(params.date)) : params.date)
            : undefined;
        const mode = params.mode ?? (normalizedDate ? 'day' : 'nearest');
        const results = [];
        await Promise.all(doctors.map(async (doc) => {
            const item = {
                doctorId: doc.id,
                doctorName: doc.name,
                speciality: doc.speciality,
                clinicId: resolvedClinicId,
                clinicName: params.clinicName,
                isAvailable: false,
                requestedDate: normalizedDate,
                requestedTime: params.time,
                slot: null,
            };
            if (params.time) {
                const dayMode = mode === 'week' ? 'week' : 'day';
                const targetDate = normalizedDate ?? toDateStr(new Date());
                const slots = await this.getDoctorSlots(doc.id, resolvedClinicId, dayMode, targetDate);
                for (const sg of slots) {
                    if (sg.times.includes(params.time)) {
                        item.isAvailable = true;
                        item.slot = {
                            date: sg.date,
                            time: params.time,
                            clinicId: sg.clinicId,
                            clinicName: sg.clinicName,
                        };
                        break;
                    }
                }
                if (!item.isAvailable) {
                    const nearestSlots = await this.getDoctorSlots(doc.id, resolvedClinicId, 'nearest', normalizedDate);
                    if (nearestSlots.length > 0 && nearestSlots[0].times.length > 0) {
                        item.slot = {
                            date: nearestSlots[0].date,
                            time: nearestSlots[0].times[0],
                            clinicId: nearestSlots[0].clinicId,
                            clinicName: nearestSlots[0].clinicName,
                        };
                    }
                }
            }
            else {
                const slots = await this.getDoctorSlots(doc.id, resolvedClinicId, mode, normalizedDate);
                if (slots.length > 0 && slots[0].times.length > 0) {
                    item.isAvailable = true;
                    item.slot = {
                        date: slots[0].date,
                        time: slots[0].times[0],
                        clinicId: slots[0].clinicId,
                        clinicName: slots[0].clinicName,
                    };
                    if (mode === 'day') {
                        item.allSlots = slots.flatMap(sg => sg.times.map(t => ({ date: sg.date, time: t, clinicId: sg.clinicId, clinicName: sg.clinicName })));
                    }
                }
            }
            results.push(item);
        }));
        return results;
    }
    async findAvailableAtTime(params) {
        const doctors = await this.findDoctors(params.speciality, params.clinicId);
        if (doctors.length === 0)
            return { available: [], nearest: [] };
        const resolvedDate = resolveRelativeDate(params.date)
            ? toDateStr(resolveRelativeDate(params.date))
            : params.date;
        const available = [];
        const allNearest = [];
        await Promise.all(doctors.map(async (doc) => {
            const daySlots = await this.getDoctorSlots(doc.id, params.clinicId, 'day', resolvedDate);
            let hasTarget = false;
            for (const sg of daySlots) {
                if (sg.times.includes(params.time)) {
                    available.push({ ...sg, doctorId: doc.id, doctorName: doc.name });
                    hasTarget = true;
                }
            }
            if (!hasTarget) {
                const nearest = await this.getDoctorSlots(doc.id, params.clinicId, 'nearest', resolvedDate);
                for (const sg of nearest) {
                    allNearest.push({ ...sg, doctorId: doc.id, doctorName: doc.name });
                }
            }
        }));
        allNearest.sort((a, b) => {
            const ta = new Date(`${a.date}T${a.times[0] ?? '00:00'}`).getTime();
            const tb = new Date(`${b.date}T${b.times[0] ?? '00:00'}`).getTime();
            return ta - tb;
        });
        return { available, nearest: available.length === 0 ? allNearest : [] };
    }
    async checkPatientTimeConflict(clientId, startTime) {
        const start = new Date(startTime);
        const slotMs = 30 * 60 * 1000;
        const from = start;
        const to = new Date(start.getTime() + slotMs);
        const [docAppt, svcAppt] = await Promise.all([
            this.appointmentRepo
                .createQueryBuilder('a')
                .innerJoinAndSelect('a.clinic', 'c')
                .leftJoinAndSelect('a.doctor', 'd')
                .where('a.patient_id = :clientId', { clientId })
                .andWhere('a.start_time >= :from AND a.start_time < :to', { from, to })
                .getOne(),
            this.serviceAppointmentRepo
                .createQueryBuilder('a')
                .innerJoinAndSelect('a.clinic', 'c')
                .innerJoinAndSelect('a.service', 's')
                .where('a.patient_id = :clientId', { clientId })
                .andWhere('a.start_time >= :from AND a.start_time < :to', { from, to })
                .getOne(),
        ]);
        if (docAppt) {
            const d = docAppt;
            return {
                id: docAppt.id,
                type: 'doctor',
                description: `${formatRuDateTime(docAppt.startTime)} у ${d.doctor?.name ?? 'врача'} в клинике ${d.clinic.name}`,
            };
        }
        if (svcAppt) {
            const s = svcAppt;
            return {
                id: svcAppt.id,
                type: 'service',
                description: `${formatRuDateTime(svcAppt.startTime)} на услугу ${s.service.name} в клинике ${s.clinic.name}`,
            };
        }
        return null;
    }
    async getPatientAppointments(clientId, limit) {
        const now = new Date();
        const [doctorAppts, serviceAppts] = await Promise.all([
            this.appointmentRepo
                .createQueryBuilder('a')
                .innerJoinAndSelect('a.clinic', 'c')
                .leftJoinAndSelect('a.doctor', 'd')
                .leftJoinAndSelect('d.speciality', 's')
                .where('a.patient_id = :clientId', { clientId })
                .andWhere('a.start_time > :now', { now })
                .orderBy('a.start_time', 'ASC')
                .getMany(),
            this.serviceAppointmentRepo
                .createQueryBuilder('a')
                .innerJoinAndSelect('a.clinic', 'c')
                .innerJoinAndSelect('a.service', 'sv')
                .where('a.patient_id = :clientId', { clientId })
                .andWhere('a.start_time > :now', { now })
                .orderBy('a.start_time', 'ASC')
                .getMany(),
        ]);
        const items = [
            ...doctorAppts.map((a) => ({
                type: 'doctor',
                date: toDateStr(a.startTime),
                time: toTimeStr(a.startTime),
                clinicName: a.clinic.name,
                doctorName: a.doctor?.name ?? undefined,
                speciality: a.doctor?.speciality?.name ?? undefined,
                _ts: a.startTime,
            })),
            ...serviceAppts.map((a) => ({
                type: 'service',
                date: toDateStr(a.startTime),
                time: toTimeStr(a.startTime),
                clinicName: a.clinic.name,
                serviceName: a.service?.name ?? undefined,
                _ts: a.startTime,
            })),
        ];
        items.sort((a, b) => a._ts.getTime() - b._ts.getTime());
        const result = items.map(({ _ts: _, ...rest }) => rest);
        return limit ? result.slice(0, limit) : result;
    }
    async findPatientAppointment(clientId, params) {
        const now = new Date();
        const { query, date, time } = params;
        const [doctorAppts, serviceAppts] = await Promise.all([
            this.appointmentRepo
                .createQueryBuilder('a')
                .innerJoinAndSelect('a.clinic', 'c')
                .leftJoinAndSelect('a.doctor', 'd')
                .leftJoinAndSelect('d.speciality', 's')
                .where('a.patient_id = :clientId', { clientId })
                .andWhere('a.start_time > :now', { now })
                .orderBy('a.start_time', 'ASC')
                .getMany(),
            this.serviceAppointmentRepo
                .createQueryBuilder('a')
                .innerJoinAndSelect('a.clinic', 'c')
                .innerJoinAndSelect('a.service', 'sv')
                .where('a.patient_id = :clientId', { clientId })
                .andWhere('a.start_time > :now', { now })
                .orderBy('a.start_time', 'ASC')
                .getMany(),
        ]);
        const results = [];
        for (const a of doctorAppts) {
            const doctorName = a.doctor?.name ?? '';
            const speciality = a.doctor?.speciality?.name ?? '';
            const apptDate = toDateStr(a.startTime);
            const apptTime = toTimeStr(a.startTime);
            const matchesQuery = !query || doctorName.toLowerCase().includes(query.toLowerCase())
                || speciality.toLowerCase().includes(query.toLowerCase());
            const matchesDate = !date || apptDate === date;
            const matchesTime = !time || apptTime.startsWith(time.slice(0, 5));
            if (matchesQuery && matchesDate && matchesTime) {
                results.push({
                    id: a.id,
                    type: 'doctor',
                    date: apptDate,
                    time: apptTime,
                    clinicId: a.clinicId,
                    clinicName: a.clinic.name,
                    doctorId: a.doctorId ?? undefined,
                    doctorName,
                    speciality,
                });
            }
        }
        for (const a of serviceAppts) {
            const serviceName = a.service?.name ?? '';
            const apptDate = toDateStr(a.startTime);
            const apptTime = toTimeStr(a.startTime);
            const matchesQuery = !query || serviceName.toLowerCase().includes(query.toLowerCase());
            const matchesDate = !date || apptDate === date;
            const matchesTime = !time || apptTime.startsWith(time.slice(0, 5));
            if (matchesQuery && matchesDate && matchesTime) {
                results.push({
                    id: a.id,
                    type: 'service',
                    date: apptDate,
                    time: apptTime,
                    clinicId: a.clinicId,
                    clinicName: a.clinic.name,
                    serviceId: a.serviceId,
                    serviceName,
                });
            }
        }
        results.sort((a, b) => {
            const ta = new Date(`${a.date}T${a.time}`).getTime();
            const tb = new Date(`${b.date}T${b.time}`).getTime();
            return ta - tb;
        });
        return results;
    }
    async cancelAppointment(id, type) {
        if (type === 'doctor') {
            const appt = await this.appointmentRepo.findOne({ where: { id } });
            if (!appt)
                return { success: false, message: 'Запись не найдена.' };
            await this.appointmentRepo.delete(id);
            this.logger.log(`Deleted doctor appointment #${id}`);
            return { success: true, message: 'Запись отменена.' };
        }
        else {
            const appt = await this.serviceAppointmentRepo.findOne({ where: { id } });
            if (!appt)
                return { success: false, message: 'Запись не найдена.' };
            await this.serviceAppointmentRepo.delete(id);
            this.logger.log(`Deleted service appointment #${id}`);
            return { success: true, message: 'Запись отменена.' };
        }
    }
    async rescheduleAppointment(params) {
        const { oldId, type, clinicId, newStartTime, patientId, comment } = params;
        const bookResult = await this.bookAppointment({
            doctorId: params.doctorId,
            serviceId: params.serviceId,
            clinicId,
            startTime: newStartTime,
            patientId,
            source: 'ai',
            comment,
        });
        if (!bookResult.success)
            return bookResult;
        await this.cancelAppointment(oldId, type);
        return bookResult;
    }
    getTools() {
        return [
            {
                name: 'get_clinics',
                description: 'Возвращает список клиник сети. Вызывай, когда нужно узнать ID клиники или предложить пациенту выбор.',
                parameters: { type: 'object', properties: {}, required: [] },
            },
            {
                name: 'find_doctors',
                description: 'Находит врачей по специальности или фамилии (нечёткий поиск). ' +
                    'Используй, когда нужно найти ID врача или список врачей по специальности. ' +
                    'Если пользователь называет фамилию врача — передавай её в поле speciality.',
                parameters: {
                    type: 'object',
                    properties: {
                        speciality: { type: 'string', description: 'Специальность или фамилия врача, например "терапевт", "Нестерова"' },
                        clinicId: { type: 'number', description: 'ID клиники (необязательно)' },
                    },
                    required: ['speciality'],
                },
            },
            {
                name: 'find_services',
                description: 'Находит медицинские услуги по названию (нечёткий поиск).',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Название услуги или её часть, например "УЗИ", "ЭКГ"' },
                        clinicId: { type: 'number', description: 'ID клиники (необязательно)' },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'get_available_slots',
                description: 'Возвращает свободные слоты для записи к врачу или на услугу. ' +
                    'Передавай ТОЛЬКО doctorId (берётся из find_doctors) — clinicId НЕ обязателен, НЕ нужно вызывать get_clinics перед этим. ' +
                    'Режимы: nearest — ближайший день со свободными слотами (используй по умолчанию); ' +
                    'day — конкретная дата (только если пациент явно назвал дату), возвращает ВСЕ доступные слоты за день; ' +
                    'week — вся неделя начиная с targetDate. ' +
                    'ВАЖНО: для вопросов "ближайшие окна", "когда можно записаться" — ВСЕГДА используй mode=nearest БЕЗ targetDate. ' +
                    'Результат mode=nearest уже содержит первый доступный день — показывай его пациенту напрямую, без упоминания дней в которых слотов нет. ' +
                    'В режиме day результат содержит клинику даже если times пустой — врач работает, но слоты заняты.',
                parameters: {
                    type: 'object',
                    properties: {
                        doctorId: { type: 'number', description: 'ID врача' },
                        serviceId: { type: 'number', description: 'ID услуги' },
                        clinicId: { type: 'number', description: 'ID клиники (необязательно)' },
                        mode: {
                            type: 'string',
                            enum: ['nearest', 'day', 'week'],
                            description: 'nearest — ближайшее окно, day — конкретный день, week — неделя',
                        },
                        targetDate: {
                            type: 'string',
                            description: 'Конкретная дата YYYY-MM-DD (только если пациент назвал число месяца), либо "завтра"/"послезавтра". Для дней недели ("в среду", "в пятницу") — используй поле dayOfWeek, не передавай вычисленную дату сюда.',
                        },
                        dayOfWeek: {
                            type: 'string',
                            description: 'День недели на русском: "понедельник", "вторник", "среда", "четверг", "пятница", "суббота". ВСЕГДА используй это поле когда пациент говорит "в среду", "в понедельник" и т.п. — сервер сам вычислит правильную дату. НЕ вычисляй дату самостоятельно.',
                        },
                        nextWeek: {
                            type: 'boolean',
                            description: 'true — если пациент сказал "следующей недели" или "в следующий [день]".',
                        },
                    },
                    required: [],
                },
            },
            {
                name: 'find_available_at_time',
                description: 'Проверяет доступность у ВСЕХ врачей заданной специальности на конкретное время. ' +
                    'Используй ВМЕСТО get_available_slots когда пациент называет конкретное время (например "в 15:00", "в 9 утра"). ' +
                    'Каждый элемент результата содержит doctorId, doctorName, clinicId, clinicName, date, times. ' +
                    'available — врачи у которых ЕСТЬ слот на запрошенное время; ' +
                    'nearest — ближайшие слоты у врачей у которых запрошенное время занято (только когда available пустой). ' +
                    'ВАЖНО: при записи используй ТОЛЬКО doctorId и clinicId из этого результата.',
                parameters: {
                    type: 'object',
                    properties: {
                        speciality: { type: 'string', description: 'Специальность врача, например "Терапевт"' },
                        date: { type: 'string', description: 'Дата YYYY-MM-DD или относительное слово: "завтра", "послезавтра", "сегодня"' },
                        time: { type: 'string', description: 'Время HH:MM, например "15:00"' },
                        clinicId: { type: 'number', description: 'ID клиники (необязательно)' },
                    },
                    required: ['speciality', 'date', 'time'],
                },
            },
            {
                name: 'find_doctors_and_slots',
                description: 'Ищет врачей по специальности / фамилии и возвращает их доступность. ' +
                    'Используй этот инструмент когда нужно показать слоты конкретного врача на дату — передай фамилию в speciality и дату в date с mode=day. ' +
                    'При mode=day результат содержит поле allSlots — массив ВСЕХ свободных слотов за день; показывай все времена из allSlots. ' +
                    'Если time не задан, возвращает ближайший свободный слот в указанном интервале (mode: nearest/day/week).',
                parameters: {
                    type: 'object',
                    properties: {
                        speciality: { type: 'string', description: 'Специальность или фамилия врача' },
                        clinicId: { type: 'number', description: 'ID клиники (необязательно)' },
                        clinicName: { type: 'string', description: 'Название клиники (необязательно)' },
                        date: { type: 'string', description: 'Дата YYYY-MM-DD, "завтра" или "послезавтра". Для дней недели используй поле dayOfWeek. Если пациент говорит "на следующей неделе" без конкретного дня — передай "следующая неделя".' },
                        dayOfWeek: { type: 'string', description: 'День недели на русском: "понедельник", "вторник", "среда", "четверг", "пятница", "суббота". Используй когда пациент говорит "в понедельник", "в следующий вторник" и т.п. — сервер сам вычислит ближайшую дату этого дня.' },
                        nextWeek: { type: 'boolean', description: 'true — если пациент сказал "следующей недели" или "в следующий [день]". Сдвигает дату на одну неделю вперёд.' },
                        time: { type: 'string', description: 'Желаемое время строго в формате HH:MM, например "09:00", "15:30". НЕ передавай сюда слова "утром", "вечером", "утреннее время" — это не валидный формат. Если пациент сказал только "утром" — не передавай time вообще, просто ищи доступные слоты.' },
                        mode: {
                            type: 'string',
                            enum: ['nearest', 'day', 'week'],
                            description: 'Если задан, используется для поиска ближайших слотов (по умолчанию nearest).',
                        },
                    },
                    required: ['speciality'],
                },
            },
            {
                name: 'find_patient_appointment',
                description: 'Ищет предстоящие записи пациента (к врачам и на услуги) для отмены или переноса. ' +
                    'Все параметры необязательны — передавай только то, что известно из запроса пациента. ' +
                    'Если пациент назвал только дату — передавай только date, без query. ' +
                    'Если пациент назвал только специальность или врача — передавай только query. ' +
                    'Возвращает список совпадений с id, doctorId/serviceId, clinicId каждой записи.',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Имя врача, фамилия или специальность, либо название процедуры' },
                        date: { type: 'string', description: 'Дата записи YYYY-MM-DD' },
                        time: { type: 'string', description: 'Время записи HH:MM' },
                        dayOfMonth: { type: 'number', description: 'Число месяца (1–31) когда пациент говорит "на 26-е", "26 числа" и т.д. Бэкенд найдёт ближайшую дату с этим числом.' },
                        dayOfWeek: { type: 'string', description: 'День недели на русском — "понедельник", "вторник" и т.д. Бэкенд автоматически вычислит ближайшую дату этого дня.' },
                        timeExpression: { type: 'string', description: 'Разговорное время — "9 утра", "6 вечера", "9:30 утра", "14:00" и т.д. Бэкенд переведёт в HH:MM.' },
                    },
                    required: [],
                },
            },
            {
                name: 'reschedule_appointment',
                description: 'Переносит запись пациента: атомарно создаёт новую запись и отменяет старую. ' +
                    'Вызывай ТОЛЬКО после того как пациент подтвердил перенос. ' +
                    'oldId, type, doctorId/serviceId и clinicId берутся из результата find_patient_appointment.',
                parameters: {
                    type: 'object',
                    properties: {
                        oldId: { type: 'number', description: 'ID старой записи из find_patient_appointment' },
                        type: { type: 'string', enum: ['doctor', 'service'], description: 'Тип записи' },
                        doctorId: { type: 'number', description: 'ID врача (для doctor)' },
                        serviceId: { type: 'number', description: 'ID услуги (для service)' },
                        clinicId: { type: 'number', description: 'ID клиники из find_patient_appointment' },
                        newStartTime: { type: 'string', description: 'Новое время записи ISO 8601, например "2026-03-27T09:30:00"' },
                        comment: { type: 'string', description: 'Имя пациента или комментарий' },
                    },
                    required: ['oldId', 'type', 'clinicId', 'newStartTime'],
                },
            },
            {
                name: 'cancel_appointment',
                description: 'Отменяет запись пациента. Вызывай ТОЛЬКО после того как пациент подтвердил отмену. ' +
                    'ID берётся из результата find_patient_appointment.',
                parameters: {
                    type: 'object',
                    properties: {
                        id: { type: 'number', description: 'ID записи из результата find_patient_appointment' },
                        type: { type: 'string', enum: ['doctor', 'service'], description: 'Тип записи' },
                    },
                    required: ['id', 'type'],
                },
            },
            {
                name: 'get_patient_appointments',
                description: 'Возвращает предстоящие записи текущего пациента к врачам и на процедуры, отсортированные по времени. ' +
                    'ОБЯЗАТЕЛЬНО вызывай этот инструмент когда пациент говорит: "покажи мои записи", "мои записи", ' +
                    '"когда я записан", "есть ли у меня запись", "ближайшая запись", "покажи расписание" и любые похожие запросы. ' +
                    'Передай limit=1 ТОЛЬКО если пациент явно просит ближайшую запись.',
                parameters: {
                    type: 'object',
                    properties: {
                        limit: { type: 'number', description: 'Максимальное число записей (1 — только ближайшая). Не передавай для показа всех.' },
                    },
                    required: [],
                },
            },
            {
                name: 'book_appointment',
                description: 'Записывает пациента к врачу или на услугу. ' +
                    'СТОП — НЕ вызывай этот инструмент пока пациент не произнёс явное слово-подтверждение: "да", "подтверждаю", "записывайте", "конечно". ' +
                    'Выбор врача ("Нестерова", "запишите к Касумову") — НЕ является подтверждением. ' +
                    'После выбора врача и времени ОБЯЗАТЕЛЬНО выведи сводку (врач, дата, время, клиника) и задай вопрос "Подтверждаете запись?" — затем жди ответа. ' +
                    'Имя пациента спрашивать не нужно — он идентифицирован автоматически.',
                parameters: {
                    type: 'object',
                    properties: {
                        doctorId: { type: 'number', description: 'ID врача (обязателен для записи к врачу; возьми из find_doctors или find_available_at_time)' },
                        serviceId: { type: 'number', description: 'ID услуги (обязателен для записи на услугу; возьми из find_services)' },
                        clinicId: { type: 'number', description: 'ID клиники (обязателен; возьми из find_doctors, find_services или find_available_at_time)' },
                        startTime: { type: 'string', description: 'Дата и время начала, ISO 8601, например "2026-03-25T10:00:00" (обязателен)' },
                        comment: { type: 'string', description: 'Дополнительный комментарий (необязательно)' },
                    },
                    required: ['clinicId', 'startTime'],
                },
            },
        ];
    }
    async executeTool(name, args, _sessionId, clientId) {
        try {
            switch (name) {
                case 'get_clinics':
                    return this.getClinics();
                case 'find_doctors':
                    return this.findDoctors(args.speciality, args.clinicId);
                case 'find_services':
                    return this.findServices(args.query, args.clinicId);
                case 'get_available_slots': {
                    const slotArgs = { ...args };
                    let resolvedTarget = slotArgs.targetDate;
                    if (slotArgs.dayOfWeek) {
                        const resolved = nearestWeekdayDate(slotArgs.dayOfWeek, slotArgs.nextWeek ? 1 : 0);
                        if (resolved)
                            resolvedTarget = resolved;
                    }
                    else if (resolvedTarget && !/^\d{4}-\d{2}-\d{2}$/.test(resolvedTarget)) {
                        const resolved = resolveRelativeDate(resolvedTarget);
                        if (resolved)
                            resolvedTarget = toDateStr(resolved);
                    }
                    return this.getAvailableSlots({
                        doctorId: slotArgs.doctorId,
                        serviceId: slotArgs.serviceId,
                        clinicId: slotArgs.clinicId,
                        mode: slotArgs.mode,
                        targetDate: resolvedTarget,
                    });
                }
                case 'find_available_at_time':
                    return this.findAvailableAtTime({
                        speciality: args.speciality,
                        date: args.date,
                        time: args.time,
                        clinicId: args.clinicId,
                    });
                case 'find_doctors_and_slots': {
                    const dsArgs = { ...args };
                    if (dsArgs.dayOfWeek) {
                        const resolved = nearestWeekdayDate(dsArgs.dayOfWeek, dsArgs.nextWeek ? 1 : 0);
                        if (resolved)
                            dsArgs.date = resolved;
                    }
                    const validTime = /^\d{1,2}:\d{2}$/.test(dsArgs.time ?? '') ? dsArgs.time : undefined;
                    const isVagueWeekQuery = dsArgs.date && !dsArgs.dayOfWeek && !/^\d{4}-\d{2}-\d{2}$/.test(dsArgs.date ?? '');
                    const effectiveMode = dsArgs.mode ?? (isVagueWeekQuery ? 'nearest' : undefined);
                    return this.findDoctorsAndSlots({
                        speciality: dsArgs.speciality,
                        clinicId: dsArgs.clinicId,
                        clinicName: dsArgs.clinicName,
                        date: dsArgs.date,
                        time: validTime,
                        mode: effectiveMode,
                    });
                }
                case 'get_patient_appointments': {
                    if (!clientId)
                        return { error: 'Пациент не идентифицирован. Функция доступна только авторизованным пользователям.' };
                    return this.getPatientAppointments(clientId, args.limit);
                }
                case 'find_patient_appointment': {
                    if (!clientId)
                        return { error: 'Пациент не идентифицирован. Функция доступна только авторизованным пользователям.' };
                    const apptArgs = { ...args };
                    if (apptArgs.dayOfMonth && !apptArgs.date) {
                        const resolved = nearestDayOfMonth(Number(apptArgs.dayOfMonth));
                        if (resolved)
                            apptArgs.date = resolved;
                    }
                    if (apptArgs.dayOfWeek && !apptArgs.date) {
                        const resolved = nearestWeekdayDate(apptArgs.dayOfWeek);
                        if (resolved)
                            apptArgs.date = resolved;
                    }
                    if (apptArgs.timeExpression && !apptArgs.time) {
                        const resolved = parseTimeExpression(apptArgs.timeExpression);
                        if (resolved)
                            apptArgs.time = resolved;
                    }
                    return this.findPatientAppointment(clientId, apptArgs);
                }
                case 'reschedule_appointment': {
                    if (!clientId)
                        return { error: 'Пациент не идентифицирован.' };
                    return this.rescheduleAppointment({ ...args, patientId: clientId });
                }
                case 'cancel_appointment': {
                    if (!clientId)
                        return { error: 'Пациент не идентифицирован.' };
                    return this.cancelAppointment(args.id, args.type);
                }
                case 'book_appointment': {
                    const bookArgs = { ...args };
                    if (!bookArgs.patientId && clientId) {
                        bookArgs.patientId = clientId;
                    }
                    return this.bookAppointment(bookArgs);
                }
                default:
                    return { error: `Unknown tool: ${name}` };
            }
        }
        catch (err) {
            this.logger.error(`Tool ${name} error: ${String(err)}`);
            return { error: `Ошибка при выполнении ${name}. Пожалуйста, уточни данные и попробуй снова.` };
        }
    }
};
exports.BookingService = BookingService;
exports.BookingService = BookingService = BookingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(clinic_entity_1.Clinic)),
    __param(1, (0, typeorm_1.InjectRepository)(doctor_entity_1.Doctor)),
    __param(2, (0, typeorm_1.InjectRepository)(doctor_location_entity_1.DoctorLocation)),
    __param(3, (0, typeorm_1.InjectRepository)(doctor_working_hours_entity_1.DoctorWorkingHours)),
    __param(4, (0, typeorm_1.InjectRepository)(doctor_exception_entity_1.DoctorException)),
    __param(5, (0, typeorm_1.InjectRepository)(service_entity_1.Service)),
    __param(6, (0, typeorm_1.InjectRepository)(service_by_clinic_entity_1.ServiceByClinic)),
    __param(7, (0, typeorm_1.InjectRepository)(service_schedule_entity_1.ServiceSchedule)),
    __param(8, (0, typeorm_1.InjectRepository)(appointment_entity_1.Appointment)),
    __param(9, (0, typeorm_1.InjectRepository)(service_working_hours_entity_1.ServiceWorkingHours)),
    __param(10, (0, typeorm_1.InjectRepository)(service_exception_entity_1.ServiceException)),
    __param(11, (0, typeorm_1.InjectRepository)(service_appointment_entity_1.ServiceAppointment)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], BookingService);
const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function formatRuDateTime(date) {
    const d = date.getDate();
    const mon = RU_MONTHS[date.getMonth()];
    const y = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${d} ${mon} ${y} в ${hh}:${mm}`;
}
function parseTimeExpression(expr) {
    const clean = expr.trim().toLowerCase();
    const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(утра|дня|вечера|ночи|часов|час)?$/);
    if (!match)
        return null;
    let h = parseInt(match[1]);
    const m = parseInt(match[2] ?? '0');
    const period = match[3] ?? '';
    if (period === 'утра') {
        if (h === 12)
            h = 0;
    }
    else if (period === 'дня' || period === 'вечера') {
        if (h !== 12)
            h += 12;
    }
    else if (period === 'ночи') {
        if (h === 12)
            h = 0;
    }
    if (h > 23 || m > 59)
        return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function nearestDayOfMonth(day) {
    if (day < 1 || day > 31)
        return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const candidate = new Date(today.getFullYear(), today.getMonth(), day);
    if (candidate < today) {
        candidate.setMonth(candidate.getMonth() + 1);
    }
    return toDateStr(candidate);
}
function nearestWeekdayDate(dayName, weekOffset = 0) {
    const map = {
        понедельник: 1, вторник: 2, среда: 3, среду: 3,
        четверг: 4, пятница: 5, пятницу: 5, суббота: 6, субботу: 6,
        воскресенье: 0,
    };
    const target = map[dayName.toLowerCase().trim()];
    if (target === undefined)
        return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const current = today.getDay();
    let diff = (target - current + 7) % 7;
    if (diff === 0)
        diff = 7;
    diff += weekOffset * 7;
    const result = new Date(today);
    result.setDate(today.getDate() + diff);
    return toDateStr(result);
}
function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function toTimeStr(date) {
    return date.toTimeString().slice(0, 5);
}
function toMinutes(t) {
    const [h, m] = t.slice(0, 5).split(':').map(Number);
    return h * 60 + m;
}
function generateSlots(date, startTime, endTime, durationMins, breakStart, breakEnd) {
    const slots = [];
    const startM = toMinutes(startTime);
    const endM = toMinutes(endTime);
    const bsM = breakStart ? toMinutes(breakStart) : null;
    const beM = breakEnd ? toMinutes(breakEnd) : null;
    for (let m = startM; m + durationMins <= endM; m += durationMins) {
        if (bsM !== null && beM !== null && m < beM && m + durationMins > bsM)
            continue;
        const slot = new Date(date);
        slot.setHours(Math.floor(m / 60), m % 60, 0, 0);
        slots.push(slot);
    }
    return slots;
}
function resolveRelativeDate(expr) {
    const s = expr.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (s === 'сегодня')
        return today;
    if (s === 'завтра') {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        return d;
    }
    if (s === 'послезавтра') {
        const d = new Date(today);
        d.setDate(d.getDate() + 2);
        return d;
    }
    if (/следующ.*недел|next week/.test(s) && !/понедельник|вторник|среда|четверг|пятница|суббота|воскресенье/.test(s)) {
        const resolved = nearestWeekdayDate('понедельник', 0);
        if (resolved) {
            const [y, m, d] = resolved.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
    }
    const dayNames = ['воскресенье', 'понедельник', 'вторник', 'среда', 'среду', 'четверг', 'пятница', 'пятницу', 'суббота', 'субботу'];
    const nextWeekOffset = /следующ/.test(s) ? 1 : 0;
    for (const name of dayNames) {
        if (s.includes(name)) {
            const resolved = nearestWeekdayDate(name, nextWeekOffset);
            if (resolved) {
                const [y, m, d] = resolved.split('-').map(Number);
                return new Date(y, m - 1, d);
            }
        }
    }
    return null;
}
function buildDateRange(mode, targetDate) {
    let from;
    if (targetDate) {
        const relative = resolveRelativeDate(targetDate);
        if (relative) {
            from = relative;
        }
        else {
            const parts = targetDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (parts) {
                let y = parseInt(parts[1]);
                const m = parseInt(parts[2]);
                const d = parseInt(parts[3]);
                const currentYear = new Date().getFullYear();
                if (y < currentYear)
                    y = currentYear;
                from = new Date(y, m - 1, d, 0, 0, 0, 0);
            }
            else {
                from = new Date();
                from.setHours(0, 0, 0, 0);
            }
        }
    }
    else {
        from = new Date();
        from.setHours(0, 0, 0, 0);
    }
    const days = mode === 'nearest' ? booking_constants_1.DEFAULT_SEARCH_DAYS :
        mode === 'day' ? 1 :
            7;
    return { from, days };
}
//# sourceMappingURL=booking.service.js.map