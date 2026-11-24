import { z } from 'zod';

/**
 * Фрейм — разобранная реплика пациента: цель + ограничения (docs/architecture/04-dialog-model.md).
 * Модель заполняет только смысл; даты, поиск и проверки делает код.
 */

export const GOALS = ['book', 'info', 'cancel', 'reschedule', 'my_appointments', 'smalltalk', 'other'] as const;
export const SUBJECTS = ['doctor', 'speciality', 'service', 'clinic', 'appointment', 'symptom'] as const;
export const QUESTIONS = ['schedule', 'price', 'address', 'hours', 'walk_in', 'has_service', 'preparation', 'other'] as const;
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const RELATIVE_DAYS = ['today', 'tomorrow', 'day_after_tomorrow'] as const;
export const TIME_OF_DAY = ['morning', 'afternoon', 'evening'] as const;

const entities = z.object({
  doctorName: z.string().min(1).optional(),
  speciality: z.string().min(1).optional(),
  serviceQuery: z.string().min(1).optional(),
  symptom: z.string().min(1).optional(),
  clinic: z.string().min(1).optional(),
  child: z.boolean().optional(),
  /** YYYY-MM-DD — только для явной даты («25 ноября»). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dayOfWeek: z.enum(DAYS).optional(),
  relativeDay: z.enum(RELATIVE_DAYS).optional(),
  nextWeek: z.boolean().optional(),
  /** HH:MM */
  time: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  timeOfDay: z.enum(TIME_OF_DAY).optional(),
  /** «сейчас», «прямо сейчас», «срочно» */
  now: z.boolean().optional(),
  visitType: z.enum(['primary', 'repeat']).optional(),
  hasReferral: z.boolean().optional(),
  lastName: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  secondName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  /** YYYY-MM-DD */
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const ENTITY_KEYS = Object.keys(entities.shape) as Array<keyof z.infer<typeof entities>>;
/** Поля, которые не уходят в модель как «текущий запрос»: персональные данные. */
export const PATIENT_KEYS = ['lastName', 'firstName', 'secondName', 'phone', 'birthday'] as const;

const baseFrame = z.object({
  /** Нет цели — реплика продолжает текущий шаг (ответ на вопрос, выбор, поправка). */
  goal: z.enum(GOALS).optional(),
  subject: z.enum(SUBJECTS).optional(),
  question: z.enum(QUESTIONS).optional(),
  entities: entities.default({}),
  /** Ответ на вопрос «да/нет» / подтверждение. */
  reply: z.enum(['yes', 'no']).optional(),
  /** Номер выбранного варианта из показанного списка (с 1). */
  choice: z.number().int().min(1).optional(),
  /** Какие поля entities пациент исправляет («нет, лучше в четверг» → ["dayOfWeek"]). */
  edit: z.array(z.string()).optional(),
  /** Поля текущего запроса, которые пациент отменил («в любое время» → ["time","timeOfDay"]). */
  unset: z.array(z.enum(ENTITY_KEYS as [string, ...string[]])).optional(),
  /**
   * Короткая реплика пациенту — когда реплика не сводится к данным (вопрос не по сценарию,
   * возражение, непонятное). Без фактов о времени, ценах и записи: их добавляет код.
   */
  say: z.string().min(1).max(400).optional(),
});

export const frameSchema = baseFrame.extend({
  /** Дополнительные цели в той же реплике («отмените и запишите на пятницу»). */
  next: z.array(baseFrame).max(3).optional(),
});

export type Frame = z.infer<typeof frameSchema>;
export type FrameEntities = z.infer<typeof entities>;
export type Goal = (typeof GOALS)[number];

/**
 * Та же структура в JSON Schema для модели. Без union-типов и null — подмножество,
 * которое понимают Qwen (response_format), GigaChat (parameters функции) и OpenAI.
 */
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
    dayOfWeek: { type: 'string', enum: [...DAYS] },
    relativeDay: { type: 'string', enum: [...RELATIVE_DAYS] },
    nextWeek: { type: 'boolean', description: '«на следующей неделе»' },
    time: { type: 'string', description: 'HH:MM, если названо время' },
    timeOfDay: { type: 'string', enum: [...TIME_OF_DAY] },
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
  goal: { type: 'string', enum: [...GOALS], description: 'Цель; не указывать, если реплика — ответ на вопрос ассистента' },
  subject: { type: 'string', enum: [...SUBJECTS] },
  question: { type: 'string', enum: [...QUESTIONS], description: 'Только для goal=info' },
  entities: entitiesJson,
  reply: { type: 'string', enum: ['yes', 'no'], description: 'Ответ да/нет на вопрос ассистента' },
  choice: { type: 'integer', description: 'Номер выбранного варианта из списка ассистента (с 1)' },
  edit: { type: 'array', items: { type: 'string' }, description: 'Поля entities, которые пациент исправляет' },
  unset: { type: 'array', items: { type: 'string', enum: [...ENTITY_KEYS] }, description: 'Поля текущего запроса, которые пациент отменил' },
  say: { type: 'string', description: 'Короткий ответ пациенту, если реплика — вопрос или замечание, а не только данные. Без времени, цен и обещаний записи' },
};

export const FRAME_JSON_SCHEMA: Record<string, unknown> = {
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

/** Разбор ответа модели: лишние поля и неверные значения отбрасываются, а не валят ход. */
export function parseFrame(data: unknown): Frame | null {
  if (!data || typeof data !== 'object') return null;
  const cleaned = dropInvalid(data as Record<string, unknown>);
  const res = frameSchema.safeParse(cleaned);
  return res.success ? res.data : null;
}

/** Убирает пустые строки/null и поля, не прошедшие схему по отдельности. */
function dropInvalid(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const shape = baseFrame.shape as Record<string, z.ZodTypeAny>;
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === '' || v === undefined) continue;
    if (k === 'entities' && typeof v === 'object') {
      const ent: Record<string, unknown> = {};
      for (const [ek, ev] of Object.entries(v as Record<string, unknown>)) {
        if (ev === null || ev === '' || ev === undefined) continue;
        const field = (entities.shape as Record<string, z.ZodTypeAny>)[ek];
        if (field && field.safeParse(ev).success) ent[ek] = ev;
      }
      out.entities = ent;
    } else if (k === 'unset' && Array.isArray(v)) {
      const keys = v.filter((x) => typeof x === 'string' && (ENTITY_KEYS as string[]).includes(x));
      if (keys.length) out.unset = [...new Set(keys)];
    } else if (k === 'next' && Array.isArray(v)) {
      out.next = v.filter((x) => x && typeof x === 'object').slice(0, 3).map((x) => dropInvalid(x as Record<string, unknown>));
    } else if (shape[k]) {
      if (shape[k].safeParse(v).success) out[k] = v;
    }
  }
  return out;
}
