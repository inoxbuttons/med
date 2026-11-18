/** Нормализация текста для поиска: нижний регистр, ё→е, только буквы/цифры/пробелы. */
export function normalize(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function words(text: string): string[] {
  return normalize(text).split(' ').filter((w) => w.length >= 2);
}

/**
 * Синонимы профиля: { узи: ['ультразвуковое исследование'] }.
 * Для индекса — дописывает к тексту ключи, чьи формы в нём встречаются, и формы встреченных ключей,
 * чтобы «узи» находило «Ультразвуковое исследование…» и наоборот.
 */
export function expandForIndex(text: string, synonyms: Record<string, string[]>): string {
  const norm = ` ${normalize(text)} `;
  const extra = new Set<string>();
  for (const [key, forms] of Object.entries(synonyms)) {
    const k = normalize(key);
    const hasKey = norm.includes(` ${k} `);
    const hasForm = forms.some((f) => norm.includes(normalize(f)));
    if (hasForm && !hasKey) extra.add(k);
    if (hasKey) forms.forEach((f) => { if (!norm.includes(normalize(f))) extra.add(normalize(f)); });
  }
  return extra.size ? `${text} ${[...extra].join(' ')}` : text;
}

/**
 * Запрос → группы для to_tsquery('russian', …): одна группа на слово запроса,
 * внутри — само слово с префиксным поиском и формы синонима (многословная форма — через AND).
 * Группы нужны для покрытия: сколько слов запроса нашлось в документе.
 */
export function toTsGroups(query: string, synonyms: Record<string, string[]>): string[] {
  const keys = new Map(Object.entries(synonyms).map(([k, v]) => [normalize(k), v]));
  const qWords = [...new Set(words(query))];
  const alts = new Map<string, Set<string>>(qWords.map((w) => [w, new Set([`${w}:*`])]));

  // Прямые синонимы: слово-ключ → формы («узи» → «ультразвуковое исследование»).
  for (const w of qWords) {
    for (const form of keys.get(w) ?? []) {
      const fw = words(form);
      if (fw.length) alts.get(w)!.add(fw.length === 1 ? `${fw[0]}:*` : `(${fw.map((x) => `${x}:*`).join(' & ')})`);
    }
  }
  // Обратные: все слова формы есть в запросе («компьютерный томограф» → «кт»).
  for (const [key, forms] of keys) {
    for (const form of forms) {
      const fw = words(form);
      if (fw.length < 2) continue;
      const matched = fw.map((f) => qWords.find((w) => sameStem(w, f)));
      if (matched.every(Boolean)) matched.forEach((w) => alts.get(w!)!.add(`${key}:*`));
    }
  }
  return qWords.map((w) => {
    const a = [...alts.get(w)!];
    return a.length === 1 ? a[0] : `(${a.join(' | ')})`;
  });
}

/** Одно слово в разных формах: общий префикс не короче 4 и отличается не больше чем на 2–3 буквы окончания. */
export function sameStem(a: string, b: string): boolean {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 4 && i >= Math.min(a.length, b.length) - 2 && Math.abs(a.length - b.length) <= 3;
}

/** Весь запрос: группы через OR (ранжирование и покрытие поднимают полные совпадения). */
export function toTsQuery(query: string, synonyms: Record<string, string[]>): string {
  return toTsGroups(query, synonyms).join(' | ');
}
