"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FRAME_JSON_SCHEMA = exports.frameSchema = exports.PATIENT_KEYS = exports.ENTITY_KEYS = exports.TIME_OF_DAY = exports.RELATIVE_DAYS = exports.DAYS = exports.QUESTIONS = exports.SUBJECTS = exports.GOALS = void 0;
exports.parseFrame = parseFrame;
const zod_1 = require("zod");
exports.GOALS = ['book', 'info', 'cancel', 'reschedule', 'my_appointments', 'smalltalk', 'other'];
exports.SUBJECTS = ['doctor', 'speciality', 'service', 'clinic', 'appointment', 'symptom'];
exports.QUESTIONS = ['schedule', 'price', 'address', 'hours', 'walk_in', 'has_service', 'preparation', 'other'];
exports.DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
exports.RELATIVE_DAYS = ['today', 'tomorrow', 'day_after_tomorrow'];
exports.TIME_OF_DAY = ['morning', 'afternoon', 'evening'];
const entities = zod_1.z.object({
    doctorName: zod_1.z.string().min(1).optional(),
    speciality: zod_1.z.string().min(1).optional(),
    serviceQuery: zod_1.z.string().min(1).optional(),
    symptom: zod_1.z.string().min(1).optional(),
    clinic: zod_1.z.string().min(1).optional(),
    child: zod_1.z.boolean().optional(),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dayOfWeek: zod_1.z.enum(exports.DAYS).optional(),
    relativeDay: zod_1.z.enum(exports.RELATIVE_DAYS).optional(),
    nextWeek: zod_1.z.boolean().optional(),
    time: zod_1.z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
    timeOfDay: zod_1.z.enum(exports.TIME_OF_DAY).optional(),
    now: zod_1.z.boolean().optional(),
    visitType: zod_1.z.enum(['primary', 'repeat']).optional(),
    hasReferral: zod_1.z.boolean().optional(),
    lastName: zod_1.z.string().min(1).optional(),
    firstName: zod_1.z.string().min(1).optional(),
    secondName: zod_1.z.string().min(1).optional(),
    phone: zod_1.z.string().min(1).optional(),
    birthday: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
exports.ENTITY_KEYS = Object.keys(entities.shape);
exports.PATIENT_KEYS = ['lastName', 'firstName', 'secondName', 'phone', 'birthday'];
const baseFrame = zod_1.z.object({
    goal: zod_1.z.enum(exports.GOALS).optional(),
    subject: zod_1.z.enum(exports.SUBJECTS).optional(),
    question: zod_1.z.enum(exports.QUESTIONS).optional(),
    entities: entities.default({}),
    reply: zod_1.z.enum(['yes', 'no']).optional(),
    choice: zod_1.z.number().int().min(1).optional(),
    edit: zod_1.z.array(zod_1.z.string()).optional(),
    unset: zod_1.z.array(zod_1.z.enum(exports.ENTITY_KEYS)).optional(),
    say: zod_1.z.string().min(1).max(400).optional(),
});
exports.frameSchema = baseFrame.extend({
    next: zod_1.z.array(baseFrame).max(3).optional(),
});
const entitiesJson = {
    type: 'object',
    properties: {
        doctorName: { type: 'string', description: 'Фамилия (и имя) врача, как назвал пациент' },
        speciality: { type: 'string', description: 'Специальность врача: невролог, гинеколог…' },
        serviceQuery: { type: 'string', description: 'Услуга/исследование 1–4 ключевыми словами: «узи щитовидной», «мрт головного мозга»' },
        symptom: { type: 'string', description: 'Жалоба пациента своими словами' },
        clinic: { type: 'string', description: 'Клиника/адрес/район, если назван' },
        child: { type: 'boolean', description: 'Приём для ребёнка' },
        date: { type: 'string', description: 'YYYY-MM-DD, только если названа дата числом' },
        dayOfWeek: { type: 'string', enum: [...exports.DAYS] },
        relativeDay: { type: 'string', enum: [...exports.RELATIVE_DAYS] },
        nextWeek: { type: 'boolean', description: '«на следующей неделе»' },
        time: { type: 'string', description: 'HH:MM, если названо время' },
        timeOfDay: { type: 'string', enum: [...exports.TIME_OF_DAY] },
        now: { type: 'boolean', description: '«сейчас», «прямо сейчас»' },
        visitType: { type: 'string', enum: ['primary', 'repeat'] },
        hasReferral: { type: 'boolean', description: 'Есть ли направление врача' },
        lastName: { type: 'string' },
        firstName: { type: 'string' },
        secondName: { type: 'string' },
        phone: { type: 'string' },
        birthday: { type: 'string', description: 'YYYY-MM-DD' },
    },
};
const frameJsonProps = {
    goal: { type: 'string', enum: [...exports.GOALS], description: 'Цель; не указывать, если реплика — ответ на вопрос ассистента' },
    subject: { type: 'string', enum: [...exports.SUBJECTS] },
    question: { type: 'string', enum: [...exports.QUESTIONS], description: 'Только для goal=info' },
    entities: entitiesJson,
    reply: { type: 'string', enum: ['yes', 'no'], description: 'Ответ да/нет на вопрос ассистента' },
    choice: { type: 'integer', description: 'Номер выбранного варианта из списка ассистента (с 1)' },
    edit: { type: 'array', items: { type: 'string' }, description: 'Поля entities, которые пациент исправляет' },
    unset: { type: 'array', items: { type: 'string', enum: [...exports.ENTITY_KEYS] }, description: 'Поля текущего запроса, которые пациент отменил' },
    say: { type: 'string', description: 'Короткий ответ пациенту, если реплика — вопрос или замечание, а не только данные. Без времени, цен и обещаний записи' },
};
exports.FRAME_JSON_SCHEMA = {
    type: 'object',
    properties: {
        ...frameJsonProps,
        next: {
            type: 'array',
            description: 'Ещё цели в той же реплике',
            items: { type: 'object', properties: frameJsonProps },
        },
    },
};
function parseFrame(data) {
    if (!data || typeof data !== 'object')
        return null;
    const cleaned = dropInvalid(data);
    const res = exports.frameSchema.safeParse(cleaned);
    return res.success ? res.data : null;
}
function dropInvalid(raw) {
    const out = {};
    const shape = baseFrame.shape;
    for (const [k, v] of Object.entries(raw)) {
        if (v === null || v === '' || v === undefined)
            continue;
        if (k === 'entities' && typeof v === 'object') {
            const ent = {};
            for (const [ek, ev] of Object.entries(v)) {
                if (ev === null || ev === '' || ev === undefined)
                    continue;
                const field = entities.shape[ek];
                if (field && field.safeParse(ev).success)
                    ent[ek] = ev;
            }
            out.entities = ent;
        }
        else if (k === 'unset' && Array.isArray(v)) {
            const keys = v.filter((x) => typeof x === 'string' && exports.ENTITY_KEYS.includes(x));
            if (keys.length)
                out.unset = [...new Set(keys)];
        }
        else if (k === 'next' && Array.isArray(v)) {
            out.next = v.filter((x) => x && typeof x === 'object').slice(0, 3).map((x) => dropInvalid(x));
        }
        else if (shape[k]) {
            if (shape[k].safeParse(v).success)
                out[k] = v;
        }
    }
    return out;
}
//# sourceMappingURL=frame.js.map