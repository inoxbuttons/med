"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPlaceholderValue = isPlaceholderValue;
exports.isMissingPhone = isMissingPhone;
exports.isMissingBirthday = isMissingBirthday;
const PLACEHOLDER_LABELS = new Set([
    'имя', 'фамилия', 'отчество', 'фио',
    'дата рождения', 'др', 'д.р.', 'дата',
    'телефон', 'тел', 'тел.', 'номер телефона', 'номер',
    'first name', 'last name', 'second name', 'middle name', 'patronymic',
    'phone', 'mobile', 'mobile phone', 'phone number',
    'birthday', 'birth date', 'date of birth', 'dob',
]);
function isPlaceholderValue(v) {
    if (v === undefined || v === null)
        return true;
    const s = String(v).trim();
    if (!s)
        return true;
    if (/^[{<].*[}>]$/.test(s))
        return true;
    return PLACEHOLDER_LABELS.has(s.toLowerCase());
}
function isMissingPhone(v) {
    if (isPlaceholderValue(v))
        return true;
    const digits = String(v).replace(/\D/g, '');
    return digits.length < 10;
}
function isMissingBirthday(v) {
    if (isPlaceholderValue(v))
        return true;
    const s = String(v).trim();
    if (/\d{4}/.test(s))
        return false;
    if (/январ|феврал|март|апрел|ма[йяе]|июн|июл|август|сентябр|октябр|ноябр|декабр/i.test(s))
        return false;
    return true;
}
//# sourceMappingURL=patient-data-utils.js.map