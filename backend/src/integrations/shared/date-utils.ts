/** Названия дней недели по индексу dbDay (1=понедельник … 7=воскресенье). */
export const DAY_NAMES = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

/** Имя дня недели ("Пятница") для YYYY-MM-DD — чтобы LLM не считала календарь сама. */
export function dayName(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const js = d.getDay(); // 0=Sun..6=Sat
  return DAY_NAMES[js === 0 ? 7 : js];
}

const WEEKDAY_INDEX: Record<string, number> = {
  понедельник: 1, вторник: 2, среда: 3, четверг: 4, пятница: 5, суббота: 6, воскресенье: 7,
};

/**
 * Дата (YYYY-MM-DD) первого вхождения дня недели с учётом сдвига по неделям.
 *   weekOffset=0 — ближайший день (но не сегодня)
 *   weekOffset=1 — первое вхождение в СЛЕДУЮЩЕЙ календарной неделе (Пн-Вс),
 *                  даже если ближайший день уже в этой неделе. Без двойного сдвига.
 *
 * Принимает каноническую форму (понедельник…воскресенье), null если неизвестно.
 */
export function nextWeekdayDate(canonical: string, weekOffset = 0): string | null {
  const target = WEEKDAY_INDEX[canonical];
  if (target === undefined) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const jsDay = today.getDay();
  const currentRu = jsDay === 0 ? 7 : jsDay;

  let diff: number;
  if (weekOffset === 0) {
    diff = (target - currentRu + 7) % 7;
    if (diff === 0) diff = 7;
  } else {
    // Сначала — начало следующей недели (понедельник). Если сегодня уже Пн, то +7.
    let toNextMon = (1 - currentRu + 7) % 7;
    if (toNextMon === 0) toNextMon = 7;
    // Позиция target внутри той недели + сдвиг по дополнительным неделям.
    diff = toNextMon + (target - 1) + (weekOffset - 1) * 7;
  }

  const result = new Date(today);
  result.setDate(today.getDate() + diff);
  return toDateStr(result);
}

const MONTHS_GEN = [
  '', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/**
 * Готовая русская формулировка даты для показа пациенту. LLM плохо переводит
 * "2026-05-26" → "26 мая" (часто ошибается на день), поэтому отдаём строку.
 *   - "Сегодня" / "Завтра" / "Послезавтра" — для ближайших трёх дней
 *   - "Вторник, 26 мая" — иначе (если год не текущий, добавляем его)
 */
export function formatRuDateLabel(dateStr: string): string {
  const rel = relativeDayLabel(dateStr);
  if (rel) return rel;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr;
  const dn = dayName(dateStr);
  const day = parseInt(m[3], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[1], 10);
  const currentYear = new Date().getFullYear();
  const yearPart = year !== currentYear ? ` ${year}` : '';
  return `${dn}, ${day} ${MONTHS_GEN[month]}${yearPart}`;
}

// ── Морфология дней недели ────────────────────────────────────────────────────
// Каноническая форма (именительный) — то, что принимают резолверы.
// Суффиксы покрывают все падежи и числа, актуальные для записей: «в среду», «со среды»,
// «до пятницы», «по понедельникам», «к четвергу», «в воскресенье» и т.д.

const DAY_FORMS: ReadonlyArray<{ stem: string; suffixes: ReadonlyArray<string>; canonical: string }> = [
  { stem: 'понедельник', suffixes: ['', 'а', 'у', 'ом', 'е', 'и', 'ам', 'ах', 'ами'], canonical: 'понедельник' },
  { stem: 'вторник',     suffixes: ['', 'а', 'у', 'ом', 'е', 'и', 'ам', 'ах', 'ами'], canonical: 'вторник' },
  { stem: 'сред',        suffixes: ['а', 'ы', 'е', 'у', 'ой', 'ою', 'ам', 'ах', 'ами'], canonical: 'среда' },
  { stem: 'четверг',     suffixes: ['', 'а', 'у', 'ом', 'е', 'и', 'ам', 'ах', 'ами'], canonical: 'четверг' },
  { stem: 'пятниц',      suffixes: ['а', 'ы', 'е', 'у', 'ей', 'ею', 'ам', 'ах', 'ами'], canonical: 'пятница' },
  { stem: 'суббот',      suffixes: ['а', 'ы', 'е', 'у', 'ой', 'ою', 'ам', 'ах', 'ами'], canonical: 'суббота' },
  { stem: 'воскресень',  suffixes: ['е', 'я', 'ю', 'ем', 'ям', 'ях', 'ями'], canonical: 'воскресенье' },
];

const RELATIVE_DAY_WORDS = new Set(['сегодня', 'завтра', 'послезавтра']);

/** Аббревиатуры дней недели → каноническая форма. */
const DAY_ABBR_MAP: Record<string, string> = {
  пн: 'понедельник',
  вт: 'вторник',
  ср: 'среда',
  чт: 'четверг',
  пт: 'пятница',
  сб: 'суббота',
  вс: 'воскресенье',
};

/**
 * Приводит любую морфологическую форму дня недели (или относительного слова) к канонической.
 * Канонические формы: "сегодня"/"завтра"/"послезавтра", "понедельник"…"воскресенье".
 * Возвращает null, если строка не распознана.
 *
 *   normalizeDayWord('субботу')  → 'суббота'
 *   normalizeDayWord('Среды')    → 'среда'
 *   normalizeDayWord('завтра')   → 'завтра'
 *   normalizeDayWord('что-то')   → null
 */
export function normalizeDayWord(s: string | undefined | null): string | null {
  if (!s) return null;
  // Снимаем хвостовые точки ("пн." → "пн") и регистр + ё.
  const t = s.toLowerCase().trim().replace(/\.+$/, '').replace(/ё/g, 'е');
  if (RELATIVE_DAY_WORDS.has(t)) return t;
  if (DAY_ABBR_MAP[t]) return DAY_ABBR_MAP[t];
  for (const { stem, suffixes, canonical } of DAY_FORMS) {
    if (!t.startsWith(stem)) continue;
    const rest = t.slice(stem.length);
    if (suffixes.includes(rest)) return canonical;
  }
  return null;
}

/**
 * Regex для поиска ПЕРВОГО слова-дня в свободном тексте. Учитывает все падежи/числа.
 * Использует negative lookbehind/lookahead по русским буквам (НЕ `\b`, который для
 * кириллицы в JS не работает).
 */
export const DAY_WORD_REGEX = new RegExp(
  '(?<![а-яё])(' +
    'сегодня|завтра|послезавтра|' +
    'понедельник(?:а|у|ом|е|и|ам|ах|ами)?|' +
    'вторник(?:а|у|ом|е|и|ам|ах|ами)?|' +
    'сред(?:а|ы|е|у|ой|ою|ам|ах|ами)|' +
    'четверг(?:а|у|ом|е|и|ам|ах|ами)?|' +
    'пятниц(?:а|ы|е|у|ей|ею|ам|ах|ами)|' +
    'суббот(?:а|ы|е|у|ой|ою|ам|ах|ами)|' +
    'воскресень(?:е|я|ю|ем|ям|ях|ями)' +
  ')(?![а-яё])',
  'iu',
);

/**
 * Аббревиатуры (пн, вт, ср, чт, пт, сб, вс) — только в безопасных контекстах,
 * чтобы не зацепить случайные «ср.» = «средний», «ВС» = «всё» и т.п.:
 *   1) после предлога: «в пн», «на ср», «до пт»
 *   2) с точкой: «пн.», «вт.», «ср.»
 */
const DAY_ABBR_AFTER_PREP_REGEX =
  /(?<![а-яё])(?:в|во|на|до|к|ко|со|по|после)\s+(пн|вт|ср|чт|пт|сб|вс)(?![а-яё\d])/iu;
const DAY_ABBR_WITH_DOT_REGEX =
  /(?<![а-яё])(пн|вт|ср|чт|пт|сб|вс)\.(?![а-яё])/iu;

/**
 * Ищет первое слово-день в тексте и возвращает его каноническую форму.
 * Сначала пытается полные формы (все падежи), потом аббревиатуры в safe-контексте.
 * Возвращает null, если ничего не найдено.
 */
export function findDayWord(text: string): string | null {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  const m = t.match(DAY_WORD_REGEX);
  if (m) return normalizeDayWord(m[1]);
  const am = t.match(DAY_ABBR_AFTER_PREP_REGEX) ?? t.match(DAY_ABBR_WITH_DOT_REGEX);
  if (am) return DAY_ABBR_MAP[am[1]] ?? null;
  return null;
}

/** Формат YYYY-MM-DD из объекта Date (локальное время). */
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "Сегодня" / "Завтра" / "Послезавтра" для YYYY-MM-DD относительно текущего дня; иначе null. */
export function relativeDayLabel(dateStr: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Завтра';
  if (diffDays === 2) return 'Послезавтра';
  return null;
}

/** Месяцы (именительный и родительный падежи) → номер. */
const RU_MONTHS: Record<string, number> = {
  'январь': 1, 'января': 1, 'янв': 1,
  'февраль': 2, 'февраля': 2, 'фев': 2,
  'март': 3, 'марта': 3, 'мар': 3,
  'апрель': 4, 'апреля': 4, 'апр': 4,
  'май': 5, 'мая': 5,
  'июнь': 6, 'июня': 6, 'июн': 6,
  'июль': 7, 'июля': 7, 'июл': 7,
  'август': 8, 'августа': 8, 'авг': 8,
  'сентябрь': 9, 'сентября': 9, 'сен': 9, 'сент': 9,
  'октябрь': 10, 'октября': 10, 'окт': 10,
  'ноябрь': 11, 'ноября': 11, 'ноя': 11, 'нояб': 11,
  'декабрь': 12, 'декабря': 12, 'дек': 12,
};

/**
 * Парсит дату рождения в произвольном формате к YYYY-MM-DD.
 * Поддерживает:
 *   - "1983-02-01"            (ISO)
 *   - "01.02.1983" / "1.2.83"  (DD.MM.YYYY с разделителями . / -)
 *   - "01/02/1983"             (DD/MM/YYYY)
 *   - "1 февраля 1983"         (русский)
 *   - "1 фев 83"               (сокращение)
 * Возвращает null, если разобрать не удалось или дата невалидна.
 * Двузначный год: 00–30 → 2000-е, 31–99 → 1900-е (для ДР).
 */
export function parseFlexibleDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;

  // ISO: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return buildDate(+iso[1], +iso[2], +iso[3]);

  // Числовой: DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY (год 2 или 4 цифры)
  const num = s.match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})$/);
  if (num) {
    const day = +num[1], month = +num[2];
    let year = +num[3];
    if (year < 100) year += year <= 30 ? 2000 : 1900;
    return buildDate(year, month, day);
  }

  // Русский с названием месяца: "1 января 1983", "1 янв 83"
  const ru = s.match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{2,4})(?:\s*(?:г|год|года)\.?)?$/);
  if (ru) {
    const day = +ru[1];
    const month = RU_MONTHS[ru[2]];
    let year = +ru[3];
    if (year < 100) year += year <= 30 ? 2000 : 1900;
    if (!month) return null;
    return buildDate(year, month, day);
  }

  return null;
}

function buildDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
