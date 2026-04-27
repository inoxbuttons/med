"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.icDateToIso = icDateToIso;
exports.isoToIcDate = isoToIcDate;
exports.toClinics = toClinics;
exports.toDoctors = toDoctors;
exports.toSlotGroups = toSlotGroups;
exports.toBookingResult = toBookingResult;
exports.toPatientAppointmentItem = toPatientAppointmentItem;
exports.toCancellableAppointment = toCancellableAppointment;
function icDateToIso(icDate) {
    return `${icDate.slice(0, 4)}-${icDate.slice(4, 6)}-${icDate.slice(6, 8)}`;
}
function isoToIcDate(isoDate) {
    return isoDate.replace(/-/g, '');
}
const DAY_NAMES = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
function toClinics(filials) {
    return filials.map((f) => ({
        id: f.FILIAL,
        name: f.FNAME,
        address: f.FADDRESS ?? null,
        phone: f.FPHONE ?? null,
    }));
}
function toDoctors(icDoctors) {
    const map = new Map();
    for (const d of icDoctors) {
        if (!map.has(d.DCODE)) {
            map.set(d.DCODE, {
                id: d.DCODE,
                name: d.DNAME,
                speciality: d.DEPNAME,
                price: d.PRICE ?? null,
                clinics: [],
            });
        }
        const existing = map.get(d.DCODE);
        if (!existing.clinics.some((c) => c.id === d.FILIAL)) {
            existing.clinics.push({ id: d.FILIAL, name: d.FNAME });
        }
    }
    return [...map.values()];
}
function toSlotGroups(slots, filials, mode) {
    const free = slots.filter((s) => s.FREETYPE === 0);
    const groups = new Map();
    for (const s of free) {
        const key = `${s.WDATE}_${s.FILIAL}`;
        if (!groups.has(key)) {
            const isoDate = icDateToIso(s.WDATE);
            const d = new Date(`${isoDate}T00:00:00`);
            const jsDay = d.getDay();
            const dbDay = jsDay === 0 ? 7 : jsDay;
            const filial = filials.find((f) => f.FILIAL === s.FILIAL);
            groups.set(key, {
                date: isoDate,
                dayName: DAY_NAMES[dbDay],
                clinicId: s.FILIAL,
                clinicName: filial?.FNAME ?? `Филиал ${s.FILIAL}`,
                times: [],
            });
        }
        const t = `${String(s.BHOUR).padStart(2, '0')}:${String(s.BMIN).padStart(2, '0')}`;
        groups.get(key).times.push(t);
    }
    const sorted = [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (mode === 'nearest') {
        if (sorted.length === 0)
            return [];
        return [{ ...sorted[0], times: sorted[0].times.slice(0, 5) }];
    }
    return sorted;
}
function toBookingResult(icResult, successMessage) {
    if (icResult.SPRESULT === 1) {
        return {
            success: true,
            appointmentId: icResult.SCHEDID,
            message: successMessage ?? icResult.SPCOMMENT ?? 'Запись подтверждена!',
        };
    }
    return {
        success: false,
        message: icResult.CHECKTEXT ?? icResult.SPCOMMENT ?? 'Ошибка при записи',
    };
}
function toPatientAppointmentItem(a) {
    return {
        type: 'doctor',
        date: a.date,
        time: a.time,
        clinicName: a.clinicName,
        doctorName: a.doctorName,
        speciality: a.depName,
    };
}
function toCancellableAppointment(a) {
    return {
        id: a.id,
        type: 'doctor',
        date: a.date,
        time: a.time,
        clinicId: a.filialId,
        clinicName: a.clinicName,
        doctorId: a.doctorCode,
        doctorName: a.doctorName,
        speciality: a.depName,
    };
}
//# sourceMappingURL=infoclinica.adapter.js.map