"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfoclinicaBookingAdapter = exports.InfoclinicaCatalogSource = void 0;
exports.icRef = icRef;
exports.parseIcRef = parseIcRef;
const mapping_1 = require("../shared/mapping");
const operator_requests_1 = require("../shared/operator-requests");
const patient_comment_1 = require("../shared/patient-comment");
function icRef(schedId, filialId) {
    return `${schedId}@${filialId}`;
}
function parseIcRef(ref) {
    const m = /^(\d+)@(\d+)$/.exec(ref);
    return m ? { schedId: Number(m[1]), filialId: Number(m[2]) } : null;
}
class InfoclinicaCatalogSource {
    constructor(clinicNetId, ic) {
        this.clinicNetId = clinicNetId;
        this.ic = ic;
    }
    clinics() {
        return this.ic.getClinics();
    }
    async doctors() {
        return (await this.ic.findDoctors('')).map(mapping_1.doctorFromInfo);
    }
    async services() {
        return [];
    }
    async searchDoctors(query, clinicId) {
        return (await this.ic.findDoctors(query, clinicId)).map(mapping_1.doctorFromInfo);
    }
    async searchServices() {
        return [];
    }
}
exports.InfoclinicaCatalogSource = InfoclinicaCatalogSource;
class InfoclinicaBookingAdapter {
    constructor(clinicNetId, ic, local) {
        this.clinicNetId = clinicNetId;
        this.ic = ic;
        this.local = local;
        this.mis = 'infoclinica';
    }
    capabilities() {
        return {
            serviceBooking: false,
            visitServices: false,
            patientAppointments: 'client_id',
            guestBooking: true,
            guestRequiredFields: ['fullName', 'phone', 'birthday'],
            reschedule: 'cancel_then_book',
        };
    }
    async findSlots(q) {
        if (!q.doctorId)
            return [];
        const groups = await this.ic.getAvailableSlots({
            doctorId: q.doctorId,
            filialId: q.clinicId,
            mode: q.mode ?? (q.date ? 'day' : 'nearest'),
            targetDate: q.date,
        });
        const slots = (0, mapping_1.slotsFromGroups)(groups, { doctorId: q.doctorId });
        return (0, mapping_1.sortSlots)(q.date && (q.mode ?? 'day') === 'day' ? slots.filter((s) => s.date === q.date) : slots);
    }
    async visitServices() {
        return [];
    }
    async book(req) {
        if (!req.doctorId) {
            return { status: 'rejected', reason: 'not_supported', message: 'Запись на услуги через МИС не поддерживается.' };
        }
        const res = await this.ic.bookAppointment({
            doctorId: req.doctorId,
            clinicId: req.slot.clinicId,
            startTime: req.slot.start,
            patientId: req.patient.clientId,
            comment: (0, patient_comment_1.bookingComment)(req.patient, req.comment),
        });
        if (res.success && res.appointmentId) {
            return { status: 'booked', appointmentRef: icRef(res.appointmentId, req.slot.clinicId), message: res.message };
        }
        const m = res.message;
        return { status: 'rejected', reason: /прошедшее/.test(m) ? 'past_time' : /не найден/.test(m) ? 'not_found' : 'error', message: m };
    }
    async cancel(ref, patient) {
        const parsed = parseIcRef(ref);
        if (!parsed || !(await this.isOwn(ref, patient)))
            return { success: false, message: 'Запись не найдена.' };
        return this.ic.cancelAppointment(parsed.schedId, parsed.filialId);
    }
    async reschedule(ref, req) {
        const cancelled = await this.cancel(ref, req.patient);
        if (!cancelled.success)
            return { status: 'rejected', reason: 'not_found', message: cancelled.message };
        const booked = await this.book(req);
        if (booked.status !== 'booked') {
            return { ...booked, message: `Старая запись отменена, но создать новую не удалось: ${booked.message}` };
        }
        return booked;
    }
    async patientAppointments(patient) {
        if (!patient.clientId)
            return [];
        const items = await this.ic.findPatientAppointment(patient.clientId, {});
        return items.map((a) => (0, mapping_1.appointmentFromCancellable)(a, icRef(a.id, a.clinicId)));
    }
    createOperatorRequest(input) {
        return (0, operator_requests_1.createOperatorRequest)(this.local, input);
    }
    async isOwn(ref, patient) {
        return (await this.patientAppointments(patient)).some((a) => a.ref === ref);
    }
}
exports.InfoclinicaBookingAdapter = InfoclinicaBookingAdapter;
//# sourceMappingURL=infoclinica.adapters.js.map