import { z } from 'zod';

const symptomHint = z.object({
  match: z.array(z.string().min(1)).min(1),
  speciality: z.string().min(1),
  fallback: z.string().optional(),
});

export const clinicProfileSchema = z.object({
  /** Каталог сети в src/clinics/nets/<slug>; у профиля по умолчанию — 'default'. */
  slug: z.string(),
  clinicNetId: z.number().int().nullable(),
  displayName: z.string().default(''),
  engine: z.enum(['tools', 'pipeline']),
  llm: z.object({
    provider: z.enum(['openai', 'gigachat', 'qwen', 'qwen3']).optional(),
    model: z.string().optional(),
  }),
  features: z.object({
    visitTypeQuestion: z.boolean(),
    referralFlow: z.enum(['operator', 'doctor', 'off']),
    showPrices: z.enum(['always', 'on_request', 'never']),
    walkIn: z.enum(['yes', 'no', 'unknown']),
    questions: z.array(z.enum(['schedule', 'price', 'address', 'hours', 'walk_in', 'has_service', 'preparation'])),
  }),
  patientFields: z.array(z.enum(['fullName', 'phone', 'birthday'])),
  synonyms: z.record(z.string(), z.array(z.string())),
  symptomHints: z.array(symptomHint),
  serviceAreas: z.array(z.object({ label: z.string().min(1), match: z.array(z.string().min(1)).min(1) })).default([]),
  templates: z.record(z.string(), z.string()),
  info: z.object({
    about: z.string().default(''),
    hours: z.string().default(''),
    phone: z.string().default(''),
  }),
});

export type ClinicProfile = z.infer<typeof clinicProfileSchema>;
export type SymptomHint = z.infer<typeof symptomHint>;

/** Слияние профилей: объекты — рекурсивно, массивы и скаляры — заменяются. */
export function mergeProfile<T>(base: T, override: unknown): T {
  if (override === undefined || override === null) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override)) {
    out[k] = mergeProfile(out[k], v);
  }
  return out as T;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
