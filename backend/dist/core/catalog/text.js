"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalize = normalize;
exports.words = words;
exports.expandForIndex = expandForIndex;
exports.toTsGroups = toTsGroups;
exports.sameStem = sameStem;
exports.toTsQuery = toTsQuery;
function normalize(text) {
    return (text ?? '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}
function words(text) {
    return normalize(text).split(' ').filter((w) => w.length >= 2);
}
function expandForIndex(text, synonyms) {
    const norm = ` ${normalize(text)} `;
    const extra = new Set();
    for (const [key, forms] of Object.entries(synonyms)) {
        const k = normalize(key);
        const hasKey = norm.includes(` ${k} `);
        const hasForm = forms.some((f) => norm.includes(normalize(f)));
        if (hasForm && !hasKey)
            extra.add(k);
        if (hasKey)
            forms.forEach((f) => { if (!norm.includes(normalize(f)))
                extra.add(normalize(f)); });
    }
    return extra.size ? `${text} ${[...extra].join(' ')}` : text;
}
function toTsGroups(query, synonyms) {
    const keys = new Map(Object.entries(synonyms).map(([k, v]) => [normalize(k), v]));
    const qWords = [...new Set(words(query))];
    const alts = new Map(qWords.map((w) => [w, new Set([`${w}:*`])]));
    for (const w of qWords) {
        for (const form of keys.get(w) ?? []) {
            const fw = words(form);
            if (fw.length)
                alts.get(w).add(fw.length === 1 ? `${fw[0]}:*` : `(${fw.map((x) => `${x}:*`).join(' & ')})`);
        }
    }
    for (const [key, forms] of keys) {
        for (const form of forms) {
            const fw = words(form);
            if (fw.length < 2)
                continue;
            const matched = fw.map((f) => qWords.find((w) => sameStem(w, f)));
            if (matched.every(Boolean))
                matched.forEach((w) => alts.get(w).add(`${key}:*`));
        }
    }
    return qWords.map((w) => {
        const a = [...alts.get(w)];
        return a.length === 1 ? a[0] : `(${a.join(' | ')})`;
    });
}
function sameStem(a, b) {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i])
        i++;
    return i >= 4 && i >= Math.min(a.length, b.length) - 2 && Math.abs(a.length - b.length) <= 3;
}
function toTsQuery(query, synonyms) {
    return toTsGroups(query, synonyms).join(' | ');
}
//# sourceMappingURL=text.js.map