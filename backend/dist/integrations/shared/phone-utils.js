"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRuPhone = normalizeRuPhone;
function normalizeRuPhone(input) {
    if (!input)
        return null;
    const digits = String(input).replace(/\D/g, '');
    if (digits.length === 11) {
        if (digits.startsWith('7'))
            return digits;
        if (digits.startsWith('8'))
            return '7' + digits.slice(1);
        return null;
    }
    if (digits.length === 10) {
        return '7' + digits;
    }
    return null;
}
//# sourceMappingURL=phone-utils.js.map