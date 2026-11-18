"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonObject = parseJsonObject;
function parseJsonObject(text) {
    const s = (text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start < 0 || end <= start)
        return null;
    try {
        return JSON.parse(s.slice(start, end + 1));
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=llm.types.js.map