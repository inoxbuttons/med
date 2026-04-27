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
var InfclinicaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfclinicaService = void 0;
const common_1 = require("@nestjs/common");
const infoclinica_mock_1 = require("./infoclinica.mock");
const infoclinica_adapter_1 = require("./infoclinica.adapter");
let InfclinicaService = InfclinicaService_1 = class InfclinicaService {
    constructor() {
        this.logger = new common_1.Logger(InfclinicaService_1.name);
        this.storedAppointments = new Map();
        const useMock = process.env.INFOCLINICA_USE_MOCK !== 'false';
        this.client = new infoclinica_mock_1.InfclinicaMockClient();
        this.logger.log(`InfclinicaService started (${useMock ? 'MOCK' : 'REAL'} mode)`);
    }
    async getClinics() {
        const filials = await this.client.getFilialList();
        return (0, infoclinica_adapter_1.toClinics)(filials);
    }
    async findDoctors(speciality, filialId) {
        const icDoctors = await this.client.getDoctorList(filialId);
        const q = speciality.toLowerCase();
        const filtered = icDoctors.filter((d) => d.DNAME.toLowerCase().includes(q) || d.DEPNAME.toLowerCase().includes(q));
        return (0, infoclinica_adapter_1.toDoctors)(filtered);
    }
    async getAvailableSlots(params) {
        const { doctorId, filialId, mode = 'nearest', targetDate } = params;
        const fromDate = targetDate ? new Date(`${targetDate}T00:00:00`) : new Date();
        const toDate = new Date(fromDate);
        toDate.setDate(toDate.getDate() + (mode === 'week' ? 14 : 14));
        const fromStr = (0, infoclinica_adapter_1.isoToIcDate)(fromDate.toISOString().slice(0, 10));
        const toStr = (0, infoclinica_adapter_1.isoToIcDate)(toDate.toISOString().slice(0, 10));
        const [slots, filials] = await Promise.all([
            this.client.getFreeSlots(doctorId, fromStr, toStr, filialId),
            this.client.getFilialList(),
        ]);
        const now = new Date();
        const futureSlots = slots.filter((s) => {
            if (s.FREETYPE !== 0)
                return false;
            const slotTime = new Date(`${(0, infoclinica_adapter_1.icDateToIso)(s.WDATE)}T${String(s.BHOUR).padStart(2, '0')}:${String(s.BMIN).padStart(2, '0')}:00`);
            return slotTime > now;
        });
        return (0, infoclinica_adapter_1.toSlotGroups)(futureSlots, filials, mode);
    }
    async bookAppointment(params) {
        const { doctorId, clinicId, startTime, patientId, comment } = params;
        const start = new Date(startTime);
        if (start <= new Date()) {
            return { success: false, message: 'Нельзя записаться на прошедшее время. Пожалуйста, выберите будущий слот.' };
        }
        const end = new Date(start.getTime() + 30 * 60_000);
        const icDoctors = await this.client.getDoctorList(clinicId);
        const doctor = icDoctors.find((d) => d.DCODE === doctorId);
        if (!doctor) {
            return { success: false, message: `Врач с id=${doctorId} не найден в МИС. Используй find_doctors для получения корректного ID.` };
        }
        const workDateStr = (0, infoclinica_adapter_1.isoToIcDate)(startTime.slice(0, 10));
        const slots = await this.client.getFreeSlots(doctorId, workDateStr, workDateStr, clinicId);
        const targetSlot = slots.find((s) => s.BHOUR === start.getHours() && s.BMIN === start.getMinutes());
        if (!targetSlot) {
            return { success: false, message: 'Выбранное время не найдено в расписании. Пожалуйста, выберите другой слот.' };
        }
        const icResult = await this.client.bookAppointment({
            DCODE: doctorId,
            WORKDATE: workDateStr,
            BHOUR: start.getHours(),
            BMIN: start.getMinutes(),
            FHOUR: end.getHours(),
            FMIN: end.getMinutes(),
            SHEDIDENT: targetSlot.SHEDIDENT,
            DEPNUM: doctor.DEPNUM,
            PCODE: -1,
            ANOTE: comment,
            ONLINETYPE: 0,
        }, clinicId);
        if (icResult.SPRESULT !== 1) {
            return (0, infoclinica_adapter_1.toBookingResult)(icResult);
        }
        const schedId = icResult.SCHEDID;
        const isoDate = (0, infoclinica_adapter_1.icDateToIso)(workDateStr);
        const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
        this.storedAppointments.set(schedId, {
            id: schedId,
            filialId: clinicId,
            doctorCode: doctorId,
            doctorName: doctor.DNAME,
            clinicName: doctor.FNAME,
            depName: doctor.DEPNAME,
            date: isoDate,
            time: timeStr,
            patientId,
        });
        this.logger.log(`IC booking #${schedId}: ${doctor.DNAME} ${isoDate} ${timeStr}`);
        return {
            success: true,
            appointmentId: schedId,
            message: `Запись подтверждена! ${doctor.DNAME}, ${formatRuDateTime(start)}, ${doctor.FNAME}.`,
        };
    }
    async cancelAppointment(schedId, filialId) {
        const result = await this.client.cancelAppointment(schedId, filialId);
        if (result.SPRESULT === 1) {
            this.storedAppointments.delete(schedId);
        }
        return { success: result.SPRESULT === 1, message: result.SPCOMMENT };
    }
    async getPatientAppointments(clientId, limit) {
        const now = new Date();
        const items = [...this.storedAppointments.values()]
            .filter((a) => a.patientId === clientId && new Date(`${a.date}T${a.time}:00`) > now)
            .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
            .map(infoclinica_adapter_1.toPatientAppointmentItem);
        return limit ? items.slice(0, limit) : items;
    }
    async findPatientAppointment(clientId, params) {
        const now = new Date();
        const { query, date, time } = params;
        return [...this.storedAppointments.values()]
            .filter((a) => {
            if (a.patientId !== clientId)
                return false;
            if (new Date(`${a.date}T${a.time}:00`) <= now)
                return false;
            if (date && a.date !== date)
                return false;
            if (time && !a.time.startsWith(time.slice(0, 5)))
                return false;
            if (query) {
                const q = query.toLowerCase();
                if (!a.doctorName.toLowerCase().includes(q) && !a.depName.toLowerCase().includes(q))
                    return false;
            }
            return true;
        })
            .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
            .map(infoclinica_adapter_1.toCancellableAppointment);
    }
    async executeTool(name, args, clientId) {
        switch (name) {
            case 'get_clinics':
                return this.getClinics();
            case 'find_doctors':
                return this.findDoctors(args.speciality, args.clinicId);
            case 'find_services':
                return [];
            case 'get_available_slots':
                return this.getAvailableSlots({
                    doctorId: args.doctorId,
                    filialId: args.clinicId,
                    mode: args.mode,
                    targetDate: args.targetDate,
                });
            case 'find_doctors_and_slots': {
                const doctors = await this.findDoctors(args.speciality, args.clinicId);
                if (doctors.length === 0)
                    return [];
                const mode = args.mode ?? (args.date ? 'day' : 'nearest');
                const results = await Promise.all(doctors.map(async (doc) => {
                    const slots = await this.getAvailableSlots({
                        doctorId: doc.id,
                        filialId: args.clinicId,
                        mode,
                        targetDate: args.date,
                    });
                    const first = slots[0];
                    return {
                        doctorId: doc.id,
                        doctorName: doc.name,
                        speciality: doc.speciality,
                        isAvailable: first != null && first.times.length > 0,
                        slot: first && first.times.length > 0
                            ? { date: first.date, time: first.times[0], clinicId: first.clinicId, clinicName: first.clinicName }
                            : null,
                        allSlots: mode === 'day'
                            ? slots.flatMap((sg) => sg.times.map((t) => ({ date: sg.date, time: t, clinicId: sg.clinicId, clinicName: sg.clinicName })))
                            : undefined,
                    };
                }));
                return results;
            }
            case 'find_available_at_time': {
                const doctors = await this.findDoctors(args.speciality, args.clinicId);
                const available = [];
                const nearest = [];
                await Promise.all(doctors.map(async (doc) => {
                    const slots = await this.getAvailableSlots({
                        doctorId: doc.id,
                        filialId: args.clinicId,
                        mode: 'day',
                        targetDate: args.date,
                    });
                    const hasTime = slots.some((sg) => sg.times.includes(args.time));
                    if (hasTime) {
                        const sg = slots.find((sg) => sg.times.includes(args.time));
                        available.push({ ...sg, doctorId: doc.id, doctorName: doc.name });
                    }
                    else {
                        const ns = await this.getAvailableSlots({ doctorId: doc.id, filialId: args.clinicId, mode: 'nearest' });
                        if (ns.length > 0)
                            nearest.push({ ...ns[0], doctorId: doc.id, doctorName: doc.name });
                    }
                }));
                return { available, nearest: available.length === 0 ? nearest : [] };
            }
            case 'book_appointment':
                return this.bookAppointment({
                    doctorId: args.doctorId,
                    clinicId: args.clinicId,
                    startTime: args.startTime,
                    patientId: clientId,
                    comment: args.comment,
                });
            case 'cancel_appointment': {
                if (!clientId)
                    return { error: 'Пациент не идентифицирован.' };
                const stored = this.storedAppointments.get(args.id);
                if (!stored)
                    return { success: false, message: 'Запись не найдена.' };
                return this.cancelAppointment(args.id, stored.filialId);
            }
            case 'reschedule_appointment': {
                if (!clientId)
                    return { error: 'Пациент не идентифицирован.' };
                const bookResult = await this.bookAppointment({
                    doctorId: args.doctorId,
                    clinicId: args.clinicId,
                    startTime: args.newStartTime,
                    patientId: clientId,
                    comment: args.comment,
                });
                if (!bookResult.success)
                    return bookResult;
                const stored = this.storedAppointments.get(args.oldId);
                if (stored)
                    await this.cancelAppointment(args.oldId, stored.filialId);
                return bookResult;
            }
            case 'get_patient_appointments':
                if (!clientId)
                    return { error: 'Пациент не идентифицирован. Функция доступна только авторизованным пользователям.' };
                return this.getPatientAppointments(clientId, args.limit);
            case 'find_patient_appointment':
                if (!clientId)
                    return { error: 'Пациент не идентифицирован. Функция доступна только авторизованным пользователям.' };
                return this.findPatientAppointment(clientId, args);
            default:
                return { error: `Unknown tool: ${name}` };
        }
    }
};
exports.InfclinicaService = InfclinicaService;
exports.InfclinicaService = InfclinicaService = InfclinicaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], InfclinicaService);
function formatRuDateTime(d) {
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]}, ${h}:${m}`;
}
//# sourceMappingURL=infoclinica.service.js.map