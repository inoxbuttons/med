"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clinicProfileSchema = void 0;
exports.mergeProfile = mergeProfile;
const zod_1 = require("zod");
const symptomHint = zod_1.z.object({
    match: zod_1.z.array(zod_1.z.string().min(1)).min(1),
    speciality: zod_1.z.string().min(1),
    fallback: zod_1.z.string().optional(),
});
exports.clinicProfileSchema = zod_1.z.object({
    slug: zod_1.z.string(),
    clinicNetId: zod_1.z.number().int().nullable(),
    displayName: zod_1.z.string().default(''),
    engine: zod_1.z.enum(['tools', 'pipeline']),
    llm: zod_1.z.object({
        provider: zod_1.z.enum(['openai', 'gigachat', 'qwen', 'qwen3']).optional(),
        model: zod_1.z.string().optional(),
    }),
    features: zod_1.z.object({
        visitTypeQuestion: zod_1.z.boolean(),
        referralFlow: zod_1.z.enum(['operator', 'doctor', 'off']),
        showPrices: zod_1.z.enum(['always', 'on_request', 'never']),
        walkIn: zod_1.z.enum(['yes', 'no', 'unknown']),
        questions: zod_1.z.array(zod_1.z.enum(['schedule', 'price', 'address', 'hours', 'walk_in', 'has_service', 'preparation'])),
    }),
    patientFields: zod_1.z.array(zod_1.z.enum(['fullName', 'phone', 'birthday'])),
    synonyms: zod_1.z.record(zod_1.z.string(), zod_1.z.array(zod_1.z.string())),
    symptomHints: zod_1.z.array(symptomHint),
    serviceAreas: zod_1.z.array(zod_1.z.object({ label: zod_1.z.string().min(1), match: zod_1.z.array(zod_1.z.string().min(1)).min(1) })).default([]),
    templates: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
    info: zod_1.z.object({
        about: zod_1.z.string().default(''),
        hours: zod_1.z.string().default(''),
        phone: zod_1.z.string().default(''),
    }),
});
function mergeProfile(base, override) {
    if (override === undefined || override === null)
        return base;
    if (!isPlainObject(base) || !isPlainObject(override))
        return override;
    const out = { ...base };
    for (const [k, v] of Object.entries(override)) {
        out[k] = mergeProfile(out[k], v);
    }
    return out;
}
function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
//# sourceMappingURL=clinic-profile.js.map