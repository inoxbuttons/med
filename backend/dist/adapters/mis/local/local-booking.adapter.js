"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalBookingAdapter = void 0;
exports.localRef = localRef;
exports.parseLocalRef = parseLocalRef;
const mapping_1 = require("../shared/mapping");
const operator_requests_1 = require("../shared/operator-requests");
const patient_comment_1 = require("../shared/patient-comment");
function localRef(kind, id) {
    return `${kind}:${id}`;
}
function parseLocalRef(ref) {
    const m = /^(doctor|service):(\d+)$/.exec(ref);
    return m ? { kind: m[1], id: Number(m[2]) } : null;
}
class LocalBookingAdapter {
    constructor(clinicNetId, local, catalog) {
        this.clinicNetId = clinicNetId;
        this.local = local;
        this.catalog = catalog;
        this.mis = 'local';
    }
    capabilities() {
        return {
            serviceBooking: true,
            visitServices: true,
            patientAppointments: 'client_id',
            guestBooking: true,
            guestRequiredFields: ['fullName', 'phone', 'birthday'],
            reschedule: 'atomic',
        };
    }
    async findSlots(q) {
        if (!q.doctorId && q.serviceId === undefined)
            return [];
        if (q.clinicId && !(await this.catalog.inNet(q.clinicId)))
            return [];
        const serviceId = q.serviceId !== undefined ? Number(q.serviceId) : undefined;
        const groups = await this.local.getAvailableSlots({
            doctorId: q.doctorId,
            serviceId: q.doctorId ? undefined : serviceId,
            clinicId: q.clinicId,
            mode: q.mode ?? (q.date ? 'day' : 'nearest'),
            targetDate: q.date,
        });
        const netIds = await this.catalog.clinicIds();
        const inNet = groups.filter((g) => netIds.has(g.clinicId));
        if (!q.doctorId)
            return (0, mapping_1.slotsFromGroups)(inNet, { serviceId });
        return (0, mapping_1.slotsFromGroups)(inNet, { doctorId: q.doctorId, doctorName: await this.catalog.doctorName(q.doctorId) });
    }
    async visitServices(doctorId, clinicId) {
        return this.local.findDoctorConsultationServices(doctorId, clinicId, this.clinicNetId);
    }
    async book(req) {
        const { slot } = req;
        if (!(await this.catalog.inNet(slot.clinicId))) {
            return { status: 'rejected', reason: 'outside_net', message: 'Клиника не входит в сеть.' };
        }
        if (!req.doctorId && req.serviceId === undefined) {
            return { status: 'rejected', reason: 'not_found', message: 'Не указан врач или услуга.' };
        }
        const clientId = req.patient.clientId;
        if (clientId) {
            const c = await this.local.checkPatientTimeConflict(clientId, slot.start);
            if (c) {
                return {
                    status: 'conflict',
                    existingRef: localRef(c.type, c.id),
                    description: c.description,
                    message: `У Вас уже есть запись на это время: ${c.description}.`,
                };
            }
        }
        const visit = req.doctorId && req.visitServiceId !== undefined
            ? `Тип приёма: услуга #${req.visitServiceId}`
            : undefined;
        const res = await this.local.bookAppointment({
            doctorId: req.doctorId,
            serviceId: req.doctorId ? undefined : Number(req.serviceId),
            clinicId: slot.clinicId,
            startTime: slot.start,
            patientId: clientId,
            comment: (0, patient_comment_1.bookingComment)(req.patient, req.comment, visit),
        });
        return this.outcome(res, req.doctorId ? 'doctor' : 'service');
    }
    async cancel(ref, patient) {
        const own = await this.findOwn(ref, patient);
        if (!own)
            return { success: false, message: 'Запись не найдена.' };
        return this.local.cancelAppointment(own.id, own.kind);
    }
    async reschedule(ref, req) {
        const own = await this.findOwn(ref, req.patient);
        if (!own)
            return { status: 'rejected', reason: 'not_found', message: 'Запись не найдена.' };
        if (!(await this.catalog.inNet(req.slot.clinicId))) {
            return { status: 'rejected', reason: 'outside_net', message: 'Клиника не входит в сеть.' };
        }
        const res = await this.local.rescheduleAppointment({
            oldId: own.id,
            type: own.kind,
            doctorId: req.doctorId,
            serviceId: req.doctorId ? undefined : Number(req.serviceId),
            clinicId: req.slot.clinicId,
            newStartTime: req.slot.start,
            patientId: req.patient.clientId,
            comment: req.comment,
        });
        return this.outcome(res, req.doctorId ? 'doctor' : 'service');
    }
    async patientAppointments(patient) {
        if (!patient.clientId)
            return [];
        const items = await this.local.findPatientAppointment(patient.clientId, {});
        const netIds = await this.catalog.clinicIds();
        return items
            .filter((a) => netIds.has(a.clinicId))
            .map((a) => (0, mapping_1.appointmentFromCancellable)(a, localRef(a.type, a.id)));
    }
    createOperatorRequest(input) {
        return (0, operator_requests_1.createOperatorRequest)(this.local, input);
    }
    async findOwn(ref, patient) {
        const parsed = parseLocalRef(ref);
        if (!parsed || !patient.clientId)
            return null;
        const mine = await this.patientAppointments(patient);
        return mine.some((a) => a.ref === ref) ? parsed : null;
    }
    outcome(res, kind) {
        if (res.success && res.appointmentId) {
            return { status: 'booked', appointmentRef: localRef(kind, res.appointmentId), message: res.message };
        }
        const m = res.message;
        const reason = /прошедшее/.test(m) ? 'past_time' : /занято/.test(m) ? 'slot_taken' : /не найден/.test(m) ? 'not_found' : 'error';
        return { status: 'rejected', reason, message: m };
    }
}
exports.LocalBookingAdapter = LocalBookingAdapter;
//# sourceMappingURL=local-booking.adapter.js.map