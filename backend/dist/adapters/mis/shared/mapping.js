"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Memo = void 0;
exports.slotsFromGroups = slotsFromGroups;
exports.sortSlots = sortSlots;
exports.doctorFromInfo = doctorFromInfo;
exports.appointmentFromCancellable = appointmentFromCancellable;
function slotsFromGroups(groups, extra = {}) {
    const slots = [];
    for (const g of groups) {
        for (const time of g.times) {
            slots.push({
                start: `${g.date}T${time}:00`,
                end: null,
                date: g.date,
                time,
                dateLabel: g.dateLabel,
                clinicId: g.clinicId,
                clinicName: g.clinicName,
                ...extra,
            });
        }
    }
    return sortSlots(slots);
}
function sortSlots(slots) {
    return slots.sort((a, b) => a.start.localeCompare(b.start) || a.clinicId - b.clinicId);
}
function doctorFromInfo(d) {
    return {
        id: d.id,
        name: d.name,
        speciality: d.speciality,
        specialityId: d.specialityId ?? null,
        price: d.price,
        clinics: d.clinics,
    };
}
function appointmentFromCancellable(a, ref) {
    return {
        ref,
        kind: a.type,
        date: a.date,
        time: a.time,
        clinicId: a.clinicId ?? null,
        clinicName: a.clinicName,
        doctorId: a.doctorId,
        doctorName: a.doctorName,
        speciality: a.speciality,
        serviceId: a.serviceId,
        serviceName: a.serviceName,
    };
}
class Memo {
    constructor(load) {
        this.load = load;
        this.value = null;
    }
    get() {
        if (!this.value) {
            this.value = this.load().catch((err) => {
                this.value = null;
                throw err;
            });
        }
        return this.value;
    }
}
exports.Memo = Memo;
//# sourceMappingURL=mapping.js.map