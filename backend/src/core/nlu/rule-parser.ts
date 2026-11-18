import { findDayWord, parseFlexibleDate } from '../../integrations/shared/date-utils';
import { normalizeRuPhone } from '../../integrations/shared/phone-utils';
import { Frame, FrameEntities } from './frame';

/**
 * Чего ждёт движок после своего последнего сообщения. От этого зависит,
 * какие короткие ответы можно понять без модели.
 */
export type Expectation =
  | { kind: 'none' }
  /** «Подтверждаете запись?» */
  | { kind: 'confirm' }
  /** Вопрос да/нет про поле (направление, «записать?»). */
  | { kind: 'yes_no'; field: 'hasReferral' | 'proceed' }
  /** Показан нумерованный список; aliases — по чему ещё узнать вариант (время, фамилия). */
  | { kind: 'choice'; options: Array<{ label: string; aliases?: string[] }> }
  | { kind: 'visit_type' }
  | { kind: 'date' }
  | { kind: 'patient_data'; fields: Array<'fullName' | 'phone' | 'birthday'> };

const YES = /(?<![а-яё])(да|ага|угу|подтверждаю|записывайте|запишите|конечно|окей|ок|верно|все верно|хорошо|давайте)(?![а-яё])/i;
const NO = /^\s*(нет|неа|не\s|не,|не надо|не нужно|отказ|отмен)/i;
const ORDINALS: Record<string, number> = {
  перв: 1, втор: 2, трет: 3, четв: 4, пят: 5, шест: 6, седьм: 7, восьм: 8,
};
const WEEKDAYS: Record<string, NonNullable<FrameEntities['dayOfWeek']>> = {
  понедельник: 'mon', вторник: 'tue', среда: 'wed', четверг: 'thu', пятница: 'fri', суббота: 'sat', воскресенье: 'sun',
};
const RELATIVE: Record<string, NonNullable<FrameEntities['relativeDay']>> = {
  сегодня: 'today', завтра: 'tomorrow', послезавтра: 'day_after_tomorrow',
};
const GREETING = /^\s*(привет|здравствуйте|здравствуй|добрый (день|вечер|утро)|доброе утро|хай|hello|hi)[\s!.,)]*$/i;
const THANKS = /^\s*(спасибо|благодарю|спс)[\s!.,)]*$/i;
const MY_APPOINTMENTS = /^\s*(мои записи|покажи(те)? (мои )?записи|когда я записан[а]?|куда я записан[а]?)[\s?!.]*$/i;

/** Короткие реплики, понятные без модели. null — нужен NLU-вызов. */
export function parseByRules(text: string, exp: Expectation): Frame | null {
  const t = (text ?? '').trim();
  if (!t) return null;

  if (GREETING.test(t) || THANKS.test(t)) return { goal: 'smalltalk', entities: {} };
  if (MY_APPOINTMENTS.test(t)) return { goal: 'my_appointments', entities: {} };

  switch (exp.kind) {
    case 'confirm':
    case 'yes_no': {
      const reply = yesNo(t);
      if (!reply) return null;
      // «нет, лучше в пятницу», «да, но после обеда» — есть поправка, её разбирает модель
      if (parseDay(t) || parseTime(t) || /(?<![а-яё])(но|лучше|а|только|если|другой|другое)(?![а-яё])/i.test(t)) return null;
      const entities: FrameEntities = exp.kind === 'yes_no' && exp.field === 'hasReferral' ? { hasReferral: reply === 'yes' } : {};
      // «да, но в четверг» — не простой ответ, нужен NLU
      return isShort(t) ? { reply, entities } : null;
    }
    case 'choice': {
      const choice = parseChoice(t, exp.options);
      return choice ? { choice, entities: {} } : null;
    }
    case 'visit_type': {
      if (/первич|впервые|первый раз/i.test(t)) return { entities: { visitType: 'primary' } };
      if (/повтор|уже был|уже была|второй раз/i.test(t)) return { entities: { visitType: 'repeat' } };
      return null;
    }
    case 'date': {
      const day = parseDay(t);
      const time = parseTime(t);
      if (!day && !time) return null;
      const rest = t.replace(/(?<![а-яё])(в|во|на|к|давайте|можно|лучше|пожалуйста)(?![а-яё])/gi, '').replace(/\d{1,2}[:.]\d{2}/g, '');
      if (!isShort(rest)) return null;
      return { entities: { ...day, ...(time ? { time } : {}) } };
    }
    case 'patient_data': {
      const data = parsePatientData(t);
      const need = exp.fields;
      const has = (f: 'fullName' | 'phone' | 'birthday') =>
        f === 'fullName' ? !!(data.lastName && data.firstName) : !!data[f];
      return need.every(has) ? { entities: data } : null;
    }
    default:
      return null;
  }
}

export function yesNo(t: string): 'yes' | 'no' | null {
  if (NO.test(t)) return 'no';
  if (YES.test(t)) return 'yes';
  return null;
}

function isShort(t: string): boolean {
  return t.split(/\s+/).filter(Boolean).length <= 4;
}

export function parseChoice(t: string, options: Array<{ label: string; aliases?: string[] }>): number | null {
  const s = t.toLowerCase().replace(/ё/g, 'е');
  const num = s.match(/^\s*(?:№\s*)?(\d{1,2})\s*[.)]?\s*$/) ?? s.match(/(?<![\d:.])(\d{1,2})(?:-?(?:й|я|ий|ой))?\s*(?:вариант|пункт)/);
  if (num) {
    const n = Number(num[1]);
    if (n >= 1 && n <= options.length) return n;
  }
  for (const [stem, n] of Object.entries(ORDINALS)) {
    if (new RegExp(`(?<![а-яё])${stem}[а-яё]*(?![а-яё])`).test(s) && /(вариант|пункт|^\s*[а-яё]+\s*$)/.test(s) && n <= options.length) return n;
  }
  // Время или фамилия из варианта: «давайте 10:30», «к Петровой»
  const time = parseTime(t);
  const matches = options
    .map((o, i) => ({ i, keys: [o.label, ...(o.aliases ?? [])].map((k) => k.toLowerCase().replace(/ё/g, 'е')) }))
    .filter(({ keys }) =>
      (time && keys.some((k) => k.includes(time))) ||
      keys.some((k) => k.split(/[\s,.;:()—-]+/).some((w) => w.length >= 4 && s.includes(w.slice(0, Math.max(4, w.length - 2))))),
    );
  return matches.length === 1 ? matches[0].i + 1 : null;
}

export function parseTime(t: string): string | null {
  const m = t.match(/(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  const h = t.toLowerCase().match(/(?<![а-яё\d])в\s+([01]?\d|2[0-3])(?:\s*(?:час|ч\.?))?(?![\d:])/);
  return h ? `${h[1].padStart(2, '0')}:00` : null;
}

export function parseDay(t: string): Pick<FrameEntities, 'dayOfWeek' | 'relativeDay' | 'nextWeek'> | null {
  const canon = findDayWord(t);
  if (!canon) return null;
  const nextWeek = /следующ[а-я]* недел/i.test(t) ? { nextWeek: true } : {};
  if (RELATIVE[canon]) return { relativeDay: RELATIVE[canon] };
  if (WEEKDAYS[canon]) return { dayOfWeek: WEEKDAYS[canon], ...nextWeek };
  return null;
}

/** ФИО, телефон, дата рождения из одного сообщения («Иванов Иван Иванович, 89001234567, 01.02.1990»). */
export function parsePatientData(t: string): Pick<FrameEntities, 'lastName' | 'firstName' | 'secondName' | 'phone' | 'birthday'> {
  const out: Pick<FrameEntities, 'lastName' | 'firstName' | 'secondName' | 'phone' | 'birthday'> = {};
  const phoneMatch = t.match(/(?<![\d+])(?:\+7|8|7)?[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/);
  if (phoneMatch) {
    const phone = normalizeRuPhone(phoneMatch[0]);
    if (phone) out.phone = phone;
  }
  const rest = phoneMatch ? t.replace(phoneMatch[0], ' ') : t;
  const dateMatch =
    rest.match(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/) ??
    rest.match(/\d{1,2}\s+[а-яё]+\s+\d{4}/i);
  if (dateMatch) {
    const d = parseFlexibleDate(dateMatch[0]);
    if (d) out.birthday = d;
  }
  const names = (dateMatch ? rest.replace(dateMatch[0], ' ') : rest)
    .match(/(?<![а-яё])[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?/g);
  if (names && names.length >= 2) {
    [out.lastName, out.firstName, out.secondName] = names;
    if (!out.secondName) delete out.secondName;
  }
  return out;
}
