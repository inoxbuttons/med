"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOperatorRequest = createOperatorRequest;
const patient_comment_1 = require("./patient-comment");
async function createOperatorRequest(local, input) {
    const serviceId = typeof input.serviceId === 'number' ? input.serviceId : undefined;
    const notes = [input.notes, serviceId === undefined && input.serviceId !== undefined ? `Услуга МИС: ${input.serviceId}` : null]
        .filter(Boolean)
        .join('. ');
    const res = await local.createOperatorRequest({
        clinicId: input.clinicId,
        serviceId,
        doctorId: input.doctorId,
        patientId: input.patient.clientId,
        patientName: (0, patient_comment_1.fullName)(input.patient) ?? undefined,
        patientPhone: input.patient.data?.phone,
        patientBirthday: input.patient.data?.birthday,
        notes: notes || undefined,
        sessionId: input.sessionId,
    });
    return { success: true, id: res.id, message: res.message };
}
//# sourceMappingURL=operator-requests.js.map