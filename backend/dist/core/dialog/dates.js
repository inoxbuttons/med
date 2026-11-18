"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slotWindow = slotWindow;
exports.targetDate = targetDate;
exports.filterSlots = filterSlots;
exports.byTime = byTime;
const date_utils_1 = require("../../integrations/shared/date-utils");
const DOW_RU = {
    mon: 'понедельник', tue: 'вторник', wed: 'среда', thu: 'четверг', fri: 'пятница', sat: 'суббота', sun: 'воскресенье',
};
function slotWindow(e, now = new Date()) {
    const date = targetDate(e, now);
    if (date)
        return { mode: 'day', date };
    if (e.nextWeek)
        return { mode: 'week', date: (0, date_utils_1.nextWeekdayDate)('понедельник', 1, now) ?? undefined };
    return { mode: 'nearest' };
}
function targetDate(e, now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (e.date)
        return e.date;
    if (e.now)
        return (0, date_utils_1.toDateStr)(today);
    if (e.relativeDay) {
        const add = { today: 0, tomorrow: 1, day_after_tomorrow: 2 }[e.relativeDay];
        return (0, date_utils_1.toDateStr)(addDays(today, add));
    }
    if (e.dayOfWeek) {
        return (0, date_utils_1.nextWeekdayDate)(DOW_RU[e.dayOfWeek], e.nextWeek ? 1 : 0, now) ?? undefined;
    }
    return undefined;
}
function filterSlots(slots, e, now = new Date()) {
    let out = slots;
    if (e.timeOfDay) {
        const [from, to] = { morning: ['00:00', '12:00'], afternoon: ['12:00', '16:00'], evening: ['16:00', '23:59'] }[e.timeOfDay];
        out = out.filter((s) => s.time >= from && s.time < to);
    }
    if (e.now) {
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        out = out.filter((s) => s.date > (0, date_utils_1.toDateStr)(now) || s.time >= hhmm);
    }
    return out;
}
function byTime(slots, time) {
    const exact = slots.find((s) => s.time === time) ?? null;
    const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const near = [...slots].sort((a, b) => Math.abs(minutes(a.time) - minutes(time)) - Math.abs(minutes(b.time) - minutes(time))).slice(0, 3);
    return { exact, near: near.sort((a, b) => a.start.localeCompare(b.start)) };
}
function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}
//# sourceMappingURL=dates.js.map