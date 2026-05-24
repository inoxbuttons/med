/**
 * Утилиты для распознавания плейсхолдер-значений, которые LLM иногда подставляет
 * вместо реальных данных пациента. Используется и chat.service.ts (ранний guard),
 * и medflex.service.ts (defense-in-depth перед обращением к API).
 */

/** Лейблы, которые LLM может скопировать из описания поля как «значение». */
const PLACEHOLDER_LABELS = new Set([
  // Русские
  'имя', 'фамилия', 'отчество', 'фио',
  'дата рождения', 'др', 'д.р.', 'дата',
  'телефон', 'тел', 'тел.', 'номер телефона', 'номер',
  // Английские
  'first name', 'last name', 'second name', 'middle name', 'patronymic',
  'phone', 'mobile', 'mobile phone', 'phone number',
  'birthday', 'birth date', 'date of birth', 'dob',
]);

/**
 * Распознаёт «не-значения», которые LLM подставила вместо реальных данных:
 *  - пусто / null / undefined
 *  - скобочные плейсхолдеры: `{ИМЯ}`, `<PHONE>`
 *  - лейбл-слова: «Имя», «Телефон», «Дата рождения» и т.п.
 */
export function isPlaceholderValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  const s = String(v).trim();
  if (!s) return true;
  if (/^[{<].*[}>]$/.test(s)) return true;
  return PLACEHOLDER_LABELS.has(s.toLowerCase());
}

/** Телефон отсутствует, если плейсхолдер ИЛИ содержит меньше 10 цифр. */
export function isMissingPhone(v: unknown): boolean {
  if (isPlaceholderValue(v)) return true;
  const digits = String(v).replace(/\D/g, '');
  return digits.length < 10;
}

/** ДР отсутствует, если плейсхолдер ИЛИ нет ни 4-значного года, ни месяца. */
export function isMissingBirthday(v: unknown): boolean {
  if (isPlaceholderValue(v)) return true;
  const s = String(v).trim();
  if (/\d{4}/.test(s)) return false;
  if (/январ|феврал|март|апрел|ма[йяе]|июн|июл|август|сентябр|октябр|ноябр|декабр/i.test(s)) return false;
  return true;
}
