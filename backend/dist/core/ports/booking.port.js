"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSlot = resolveSlot;
async function resolveSlot(port, target) {
    const start = target.start.slice(0, 16);
    const slots = await port.findSlots({
        doctorId: target.doctorId,
        serviceId: target.serviceId,
        clinicId: target.clinicId,
        mode: 'day',
        date: start.slice(0, 10),
    });
    return slots.find((s) => s.start.slice(0, 16) === start) ?? null;
}
//# sourceMappingURL=booking.port.js.map