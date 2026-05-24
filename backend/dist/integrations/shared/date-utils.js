"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAY_WORD_REGEX = exports.DAY_NAMES = void 0;
exports.dayName = dayName;
exports.nextWeekdayDate = nextWeekdayDate;
exports.formatRuDateLabel = formatRuDateLabel;
exports.normalizeDayWord = normalizeDayWord;
exports.findDayWord = findDayWord;
exports.toDateStr = toDateStr;
exports.relativeDayLabel = relativeDayLabel;
exports.parseFlexibleDate = parseFlexibleDate;
exports.DAY_NAMES = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
function dayName(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    const js = d.getDay();
    return exports.DAY_NAMES[js === 0 ? 7 : js];
}
const WEEKDAY_INDEX = {
    понедельник: 1, вторник: 2, среда: 3, четверг: 4, пятница: 5, суббота: 6, воскресенье: 7,
};
function nextWeekdayDate(canonical, weekOffset = 0) {
    const target = WEEKDAY_INDEX[canonical];
    if (target === undefined)
        return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const jsDay = today.getDay();
    const currentRu = jsDay === 0 ? 7 : jsDay;
    let diff;
    if (weekOffset === 0) {
        diff = (target - currentRu + 7) % 7;
        if (diff === 0)
            diff = 7;
    }
    else {
        let toNextMon = (1 - currentRu + 7) % 7;
        if (toNextMon === 0)
            toNextMon = 7;
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
function formatRuDateLabel(dateStr) {
    const rel = relativeDayLabel(dateStr);
    if (rel)
        return rel;
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m)
        return dateStr;
    const dn = dayName(dateStr);
    const day = parseInt(m[3], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[1], 10);
    const currentYear = new Date().getFullYear();
    const yearPart = year !== currentYear ? ` ${year}` : '';
    return `${dn}, ${day} ${MONTHS_GEN[month]}${yearPart}`;
}
const DAY_FORMS = [
    { stem: 'понедельник', suffixes: ['', 'а', 'у', 'ом', 'е', 'и', 'ам', 'ах', 'ами'], canonical: 'понедельник' },
    { stem: 'вторник', suffixes: ['', 'а', 'у', 'ом', 'е', 'и', 'ам', 'ах', 'ами'], canonical: 'вторник' },
    { stem: 'сред', suffixes: ['а', 'ы', 'е', 'у', 'ой', 'ою', 'ам', 'ах', 'ами'], canonical: 'среда' },
    { stem: 'четверг', suffixes: ['', 'а', 'у', 'ом', 'е', 'и', 'ам', 'ах', 'ами'], canonical: 'четверг' },
    { stem: 'пятниц', suffixes: ['а', 'ы', 'е', 'у', 'ей', 'ею', 'ам', 'ах', 'ами'], canonical: 'пятница' },
    { stem: 'суббот', suffixes: ['а', 'ы', 'е', 'у', 'ой', 'ою', 'ам', 'ах', 'ами'], canonical: 'суббота' },
    { stem: 'воскресень', suffixes: ['е', 'я', 'ю', 'ем', 'ям', 'ях', 'ями'], canonical: 'воскресенье' },
];
const RELATIVE_DAY_WORDS = new Set(['сегодня', 'завтра', 'послезавтра']);
const DAY_ABBR_MAP = {
    пн: 'понедельник',
    вт: 'вторник',
    ср: 'среда',
    чт: 'четверг',
    пт: 'пятница',
    сб: 'суббота',
    вс: 'воскресенье',
};
function normalizeDayWord(s) {
    if (!s)
        return null;
    const t = s.toLowerCase().trim().replace(/\.+$/, '').replace(/ё/g, 'е');
    if (RELATIVE_DAY_WORDS.has(t))
        return t;
    if (DAY_ABBR_MAP[t])
        return DAY_ABBR_MAP[t];
    for (const { stem, suffixes, canonical } of DAY_FORMS) {
        if (!t.startsWith(stem))
            continue;
        const rest = t.slice(stem.length);
        if (suffixes.includes(rest))
            return canonical;
    }
    return null;
}
exports.DAY_WORD_REGEX = new RegExp('(?<![а-яё])(' +
    'сегодня|завтра|послезавтра|' +
    'понедельник(?:а|у|ом|е|и|ам|ах|ами)?|' +
    'вторник(?:а|у|ом|е|и|ам|ах|ами)?|' +
    'сред(?:а|ы|е|у|ой|ою|ам|ах|ами)|' +
    'четверг(?:а|у|ом|е|и|ам|ах|ами)?|' +
    'пятниц(?:а|ы|е|у|ей|ею|ам|ах|ами)|' +
    'суббот(?:а|ы|е|у|ой|ою|ам|ах|ами)|' +
    'воскресень(?:е|я|ю|ем|ям|ях|ями)' +
    ')(?![а-яё])', 'iu');
const DAY_ABBR_AFTER_PREP_REGEX = /(?<![а-яё])(?:в|во|на|до|к|ко|со|по|после)\s+(пн|вт|ср|чт|пт|сб|вс)(?![а-яё\d])/iu;
const DAY_ABBR_WITH_DOT_REGEX = /(?<![а-яё])(пн|вт|ср|чт|пт|сб|вс)\.(?![а-яё])/iu;
function findDayWord(text) {
    const t = text.toLowerCase().replace(/ё/g, 'е');
    const m = t.match(exports.DAY_WORD_REGEX);
    if (m)
        return normalizeDayWord(m[1]);
    const am = t.match(DAY_ABBR_AFTER_PREP_REGEX) ?? t.match(DAY_ABBR_WITH_DOT_REGEX);
    if (am)
        return DAY_ABBR_MAP[am[1]] ?? null;
    return null;
}
function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function relativeDayLabel(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${dateStr}T00:00:00`);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0)
        return 'Сегодня';
    if (diffDays === 1)
        return 'Завтра';
    if (diffDays === 2)
        return 'Послезавтра';
    return null;
}
const RU_MONTHS = {
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
function parseFlexibleDate(input) {
    if (!input)
        return null;
    const s = String(input).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!s)
        return null;
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso)
        return buildDate(+iso[1], +iso[2], +iso[3]);
    const num = s.match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})$/);
    if (num) {
        const day = +num[1], month = +num[2];
        let year = +num[3];
        if (year < 100)
            year += year <= 30 ? 2000 : 1900;
        return buildDate(year, month, day);
    }
    const ru = s.match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{2,4})(?:\s*(?:г|год|года)\.?)?$/);
    if (ru) {
        const day = +ru[1];
        const month = RU_MONTHS[ru[2]];
        let year = +ru[3];
        if (year < 100)
            year += year <= 30 ? 2000 : 1900;
        if (!month)
            return null;
        return buildDate(year, month, day);
    }
    return null;
}
function buildDate(year, month, day) {
    if (year < 1900 || year > 2100)
        return null;
    if (month < 1 || month > 12)
        return null;
    if (day < 1 || day > 31)
        return null;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day)
        return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
//# sourceMappingURL=date-utils.js.map