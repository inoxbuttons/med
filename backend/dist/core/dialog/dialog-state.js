"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyState = emptyState;
exports.invalidate = invalidate;
exports.summarize = summarize;
function emptyState() {
    return { goal: null, entities: {}, options: [], expectation: { kind: 'none' }, queue: [] };
}
function invalidate(state, changed) {
    const has = (...keys) => keys.some((k) => changed.includes(k));
    if (has('doctorName', 'speciality', 'serviceQuery', 'symptom', 'child')) {
        state.target = undefined;
        state.visit = undefined;
        state.hasReferral = undefined;
    }
    if (has('doctorName', 'speciality', 'serviceQuery', 'symptom', 'child', 'date', 'dayOfWeek', 'relativeDay', 'nextWeek', 'time', 'timeOfDay', 'now', 'clinic')) {
        state.slot = undefined;
    }
    if (has('visitType'))
        state.visit = undefined;
}
function summarize(state) {
    if (!state.goal)
        return 'нет активной цели';
    const parts = [goalLabel(state.goal)];
    if (state.target)
        parts.push(state.target.kind === 'service' ? `услуга: ${state.target.name}` : state.target.kind === 'doctor' ? `врач: ${state.target.name}` : `специальность: ${state.target.title}`);
    if (state.slot)
        parts.push(`выбрано время: ${state.slot.dateLabel} ${state.slot.time}`);
    if (state.appointment)
        parts.push(`запись: ${state.appointment.date} ${state.appointment.time}`);
    return parts.join('; ');
}
function goalLabel(goal) {
    return {
        book: 'запись', info: 'вопрос', cancel: 'отмена записи', reschedule: 'перенос записи',
        my_appointments: 'просмотр записей', smalltalk: 'разговор', other: 'прочее',
    }[goal];
}
//# sourceMappingURL=dialog-state.js.map