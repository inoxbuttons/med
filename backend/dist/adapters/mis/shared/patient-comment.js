"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fullName = fullName;
exports.bookingComment = bookingComment;
function fullName(p) {
    const d = p.data;
    if (!d)
        return null;
    const name = [d.lastName, d.firstName, d.secondName].filter(Boolean).join(' ').trim();
    return name || null;
}
function bookingComment(patient, comment, extra) {
    const parts = [];
    if (comment)
        parts.push(comment);
    if (extra)
        parts.push(extra);
    if (!patient.clientId && patient.data) {
        const d = patient.data;
        parts.push(`Пациент: ${fullName(patient) ?? '—'}, тел. ${d.phone || '—'}, д. р. ${d.birthday || '—'}`);
    }
    return parts.length ? parts.join('. ') : undefined;
}
//# sourceMappingURL=patient-comment.js.map