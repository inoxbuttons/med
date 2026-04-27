"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfclinicaMockClient = void 0;
const MOCK_FILIALS = [
    { FILIAL: 1, FNAME: '21 Век на Русском поле', FADDRESS: 'ул. Русское поле, 15', FPHONE: '+7(8634)38-00-08', CASHID: 101 },
    { FILIAL: 2, FNAME: '21 Век на Северном', FADDRESS: 'пр. Северный, 34', FPHONE: '+7(8634)38-00-08', CASHID: 102 },
];
const MOCK_DEPARTMENTS = [
    { DEPNUM: 10, DEPNAME: 'Терапия' },
    { DEPNUM: 20, DEPNAME: 'Неврология' },
    { DEPNUM: 30, DEPNAME: 'Кардиология' },
    { DEPNUM: 40, DEPNAME: 'Гинекология' },
    { DEPNUM: 50, DEPNAME: 'Эндокринология' },
    { DEPNUM: 60, DEPNAME: 'Офтальмология' },
    { DEPNUM: 70, DEPNAME: 'УЗИ' },
    { DEPNUM: 80, DEPNAME: 'Хирургия' },
];
const MOCK_DOCTORS = [
    { DCODE: 10000001, DNAME: 'Касумов Гусейн Шакирович', DEPNUM: 10, DEPNAME: 'Терапия', FILIAL: 1, FNAME: '21 Век на Русском поле', EXTPCODE: 'EXT-001', PRICE: 1500 },
    { DCODE: 10000002, DNAME: 'Нестерова Ирина Ивановна', DEPNUM: 10, DEPNAME: 'Терапия', FILIAL: 1, FNAME: '21 Век на Русском поле', EXTPCODE: 'EXT-002', PRICE: 1500 },
    { DCODE: 10000003, DNAME: 'Савченко Ирина Олеговна', DEPNUM: 10, DEPNAME: 'Терапия', FILIAL: 1, FNAME: '21 Век на Русском поле', EXTPCODE: 'EXT-003', PRICE: 1500 },
    { DCODE: 10000004, DNAME: 'Шанько Наталья Владимировна', DEPNUM: 10, DEPNAME: 'Терапия', FILIAL: 2, FNAME: '21 Век на Северном', EXTPCODE: 'EXT-004', PRICE: 1500 },
    { DCODE: 10000005, DNAME: 'Петрова Анна Сергеевна', DEPNUM: 20, DEPNAME: 'Неврология', FILIAL: 1, FNAME: '21 Век на Русском поле', PRICE: 1800 },
    { DCODE: 10000006, DNAME: 'Сидоров Дмитрий Александрович', DEPNUM: 30, DEPNAME: 'Кардиология', FILIAL: 1, FNAME: '21 Век на Русском поле', PRICE: 2000 },
    { DCODE: 10000007, DNAME: 'Иванова Марина Петровна', DEPNUM: 40, DEPNAME: 'Гинекология', FILIAL: 2, FNAME: '21 Век на Северном', PRICE: 1700 },
    { DCODE: 10000008, DNAME: 'Козлов Евгений Николаевич', DEPNUM: 70, DEPNAME: 'УЗИ', FILIAL: 1, FNAME: '21 Век на Русском поле', PRICE: 1200 },
];
function toIcDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
}
function fromIcDate(s) {
    return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00`);
}
function generateScheduleIntervals(doctorCode, filialId, fromDateStr, toDateStr) {
    const doctor = MOCK_DOCTORS.find((d) => d.DCODE === doctorCode && d.FILIAL === filialId);
    if (!doctor)
        return [];
    const result = [];
    const from = fromIcDate(fromDateStr);
    const to = fromIcDate(toDateStr);
    let schedId = doctorCode * 1000;
    for (const d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow === 0 || dow === 6)
            continue;
        result.push({
            SCHEDIDENT: schedId++,
            DCODE: doctor.DCODE,
            DNAME: doctor.DNAME,
            DEPNUM: doctor.DEPNUM,
            DEPNAME: doctor.DEPNAME,
            FILIAL: doctor.FILIAL,
            FNAME: doctor.FNAME,
            WDATE: toIcDate(d),
            BEGHOUR: 8,
            BEGMIN: 0,
            ENDHOUR: 17,
            ENDMIN: 0,
            ONLINEMODE: 0,
        });
    }
    return result;
}
let slotIdCounter = 100000;
function generateFreeSlots(doctorCode, fromDateStr, toDateStr, filialId) {
    const doctor = MOCK_DOCTORS.find((d) => d.DCODE === doctorCode && (filialId === undefined || d.FILIAL === filialId));
    if (!doctor)
        return [];
    const occupied = new Set([
        `${toIcDate(addDays(new Date(), 1))}_09_00`,
        `${toIcDate(addDays(new Date(), 1))}_10_30`,
        `${toIcDate(addDays(new Date(), 2))}_08_00`,
        `${toIcDate(addDays(new Date(), 3))}_14_00`,
    ]);
    const result = [];
    const from = fromIcDate(fromDateStr);
    const to = fromIcDate(toDateStr);
    for (const d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow === 0 || dow === 6)
            continue;
        for (let h = 8; h < 17; h++) {
            for (const m of [0, 30]) {
                if (h === 16 && m === 30)
                    break;
                const endH = m === 30 ? h + 1 : h;
                const endM = m === 30 ? 0 : 30;
                const key = `${toIcDate(d)}_${String(h).padStart(2, '0')}_${String(m).padStart(2, '0')}`;
                const isOccupied = occupied.has(key);
                result.push({
                    SHEDIDENT: slotIdCounter++,
                    DCODE: doctor.DCODE,
                    WDATE: toIcDate(d),
                    BHOUR: h,
                    BMIN: m,
                    FHOUR: endH,
                    FMIN: endM,
                    FREETYPE: isOccupied ? 1 : 0,
                    FILIAL: doctor.FILIAL,
                    DEPNUM: doctor.DEPNUM,
                });
            }
        }
    }
    return result;
}
function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}
const mockAppointments = new Map();
let mockSchedIdCounter = 9000001;
class InfclinicaMockClient {
    async getFilialList() {
        return MOCK_FILIALS;
    }
    async getDepartmentList() {
        return MOCK_DEPARTMENTS;
    }
    async getDoctorList(filialId) {
        if (filialId !== undefined) {
            return MOCK_DOCTORS.filter((d) => d.FILIAL === filialId);
        }
        return MOCK_DOCTORS;
    }
    async getDoctorSchedule(filialId, fromDate, toDate) {
        const doctors = MOCK_DOCTORS.filter((d) => d.FILIAL === filialId);
        const result = [];
        for (const doc of doctors) {
            result.push(...generateScheduleIntervals(doc.DCODE, filialId, fromDate, toDate));
        }
        return result;
    }
    async getFreeSlots(doctorCode, fromDate, toDate, filialId) {
        return generateFreeSlots(doctorCode, fromDate, toDate, filialId);
    }
    async bookAppointment(request, _filialId) {
        const slots = await this.getFreeSlots(request.DCODE, request.WORKDATE, request.WORKDATE, request.PCODE);
        const targetSlot = slots.find((s) => s.BHOUR === request.BHOUR && s.BMIN === request.BMIN);
        if (targetSlot && targetSlot.FREETYPE !== 0) {
            return { SPRESULT: 2, SPCOMMENT: 'Выбранное время уже занято. Пожалуйста, выберите другое.' };
        }
        const schedId = mockSchedIdCounter++;
        mockAppointments.set(schedId, { request, filialId: _filialId });
        return {
            SPRESULT: 1,
            SPCOMMENT: 'Запись успешно создана',
            SCHEDID: schedId,
        };
    }
    async cancelAppointment(schedId, _filialId) {
        if (!mockAppointments.has(schedId)) {
            return { SPRESULT: 2, SPCOMMENT: `Запись ${schedId} не найдена` };
        }
        mockAppointments.delete(schedId);
        return { SPRESULT: 1, SPCOMMENT: 'Запись успешно отменена' };
    }
    async registerPatient(patient) {
        return { SPRESULT: 1, SPCOMMENT: 'Пациент найден или зарегистрирован', PCODE: 999001 };
    }
    async getServices(doctorCode, depNum, filialId) {
        const doctor = MOCK_DOCTORS.find((d) => d.DCODE === doctorCode);
        if (!doctor)
            return [];
        return [
            {
                SCHID: 5001,
                KODOPER: 'B01.047.001',
                SCHNAME: 'Приём (осмотр, консультация) врача-терапевта первичный',
                SPRICE: doctor.PRICE ?? 1500,
                DISCPRICE: 0,
                FILIAL: filialId,
                FNAME: doctor.FNAME,
                SPECCODE: depNum,
                SPECNAME: doctor.DEPNAME,
                COMMENT: 'Первичная консультация',
                SCHSCHEDTYPE: 1,
            },
            {
                SCHID: 5002,
                KODOPER: 'B01.047.002',
                SCHNAME: 'Приём (осмотр, консультация) врача-терапевта повторный',
                SPRICE: (doctor.PRICE ?? 1500) * 0.9,
                DISCPRICE: 0,
                FILIAL: filialId,
                FNAME: doctor.FNAME,
                SPECCODE: depNum,
                SPECNAME: doctor.DEPNAME,
                COMMENT: 'Повторная консультация (скидка 10%)',
                SCHSCHEDTYPE: 1,
            },
        ];
    }
}
exports.InfclinicaMockClient = InfclinicaMockClient;
//# sourceMappingURL=infoclinica.mock.js.map