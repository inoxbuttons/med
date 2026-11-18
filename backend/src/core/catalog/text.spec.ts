import { buildIndexDocs } from './catalog-indexer.service';
import { decide, SearchHit } from './catalog-search.service';
import { expandForIndex, normalize, sameStem, toTsGroups } from './text';

const syn = {
  узи: ['ультразвуковое исследование'],
  кт: ['компьютерная томография'],
  мрт: ['магнитно-резонансная томография'],
};

describe('text', () => {
  it('normalize', () => {
    expect(normalize('  Ёжик, МРТ-исследование! ')).toBe('ежик мрт исследование');
  });

  it('прямой синоним: «узи» ищет и «ультразвуковое исследование»', () => {
    expect(toTsGroups('узи щитовидной', syn)).toEqual([
      '(узи:* | (ультразвуковое:* & исследование:*))',
      'щитовидной:*',
    ]);
  });

  it('обратный синоним: «компьютерный томограф» ищет и «кт»', () => {
    expect(toTsGroups('Компьютерный томограф', syn)).toEqual(['(компьютерный:* | кт:*)', '(томограф:* | кт:*)']);
    expect(toTsGroups('Магнитно-резонансный томограф', syn)).toEqual([
      '(магнитно:* | мрт:*)', '(резонансный:* | мрт:*)', '(томограф:* | мрт:*)',
    ]);
    // одно слово формы — не повод добавлять ключ
    expect(toTsGroups('томограф', syn)).toEqual(['томограф:*']);
  });

  it('sameStem', () => {
    expect(sameStem('томограф', 'томография')).toBe(true);
    expect(sameStem('компьютерный', 'компьютерная')).toBe(true);
    expect(sameStem('кот', 'кости')).toBe(false);
    expect(sameStem('зубов', 'зубовидного')).toBe(false);
  });

  it('индекс дописывает ключ синонима к тексту с его формой', () => {
    expect(expandForIndex('Ультразвуковое исследование почек', syn)).toBe('Ультразвуковое исследование почек узи');
    expect(expandForIndex('УЗИ сердца', syn)).toBe('УЗИ сердца ультразвуковое исследование');
  });
});

describe('buildIndexDocs', () => {
  it('услуги, врачи и специальности (одна на разные написания)', () => {
    const docs = buildIndexDocs(
      [{ id: 1, name: 'УЗИ сердца', direction: 'Ультразвуковая диагностика', selfBooking: true, atDoctorVisit: false, stationary: false, priceFrom: false, clinics: [{ id: 3, name: 'А', price: 100 }] }],
      [
        { id: 10, name: 'Иванова', speciality: 'Врач-невролог', specialityId: null, price: null, clinics: [{ id: 3, name: 'А' }] },
        { id: 11, name: 'Петрова', speciality: 'врач  невролог', specialityId: null, price: null, clinics: [{ id: 4, name: 'Б' }] },
      ],
      syn,
    );
    expect(docs.map((d) => `${d.kind}:${d.entityId}`)).toEqual(['service:1', 'doctor:10', 'doctor:11', 'speciality:врач невролог']);
    expect(docs[3].meta).toEqual({ doctorIds: [10, 11], clinicIds: [3, 4] });
    expect(docs[0].meta.clinicIds).toEqual([3]);
  });
});

describe('decide', () => {
  const hit = (title: string, score: number, ranks = { fts: 1, trgm: 1, vector: null as number | null }): SearchHit =>
    ({ kind: 'service', entityId: title, title, score, ranks, trgm: 0, coverage: 1, vecSim: null, prefix: false, meta: {} });

  it('точное совпадение названия — single', () => {
    const d = decide('Эхокардиография', [hit('Эхокардиография плода', 0.03), hit('Эхокардиография', 0.03)]);
    expect(d).toMatchObject({ kind: 'single', hit: { title: 'Эхокардиография' } });
  });

  it('заметный отрыв двумя способами — single, иначе choice', () => {
    expect(decide('x', [hit('A', 0.032), hit('B', 0.016)]).kind).toBe('single');
    expect(decide('x', [hit('A', 0.032), hit('B', 0.030)]).kind).toBe('choice');
    expect(decide('x', [hit('A', 0.032, { fts: 1, trgm: null, vector: null }), hit('B', 0.016)]).kind).toBe('choice');
    expect(decide('x', []).kind).toBe('none');
  });
});
