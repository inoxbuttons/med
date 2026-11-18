import * as path from 'path';
import { Appointment, Slot } from '../domain';
import { BookingPort } from '../ports';
import { SearchHit } from '../catalog/catalog-search.service';
import { Frame } from '../nlu/frame';
import { parseByRules } from '../nlu/rule-parser';
import { ClinicProfileService } from '../profile/clinic-profile.service';
import { DialogEngine, EngineDeps } from './dialog-engine.service';
import { DialogSession, emptyState } from './dialog-state';

const NOW = new Date(2026, 10, 18, 9, 0); // среда, 18 ноября 2026, 09:00

const profiles = new ClinicProfileService(path.resolve(__dirname, '../../clinics'));
profiles.reload();

// ── Каталог ────────────────────────────────────────────────────────────────
type Doc = { kind: 'service' | 'speciality' | 'doctor'; id: string; title: string; meta: Record<string, any> };
const CATALOG: Doc[] = [
  { kind: 'doctor', id: '10', title: 'Нестерова Ольга Ивановна', meta: { speciality: 'Невролог', clinicIds: [3] } },
  { kind: 'doctor', id: '11', title: 'Петров Пётр Петрович', meta: { speciality: 'Гастроэнтеролог', clinicIds: [3] } },
  { kind: 'speciality', id: 'невролог', title: 'Невролог', meta: { doctorIds: [10], clinicIds: [3] } },
  { kind: 'speciality', id: 'гастроэнтеролог', title: 'Гастроэнтеролог', meta: { doctorIds: [11], clinicIds: [3] } },
  { kind: 'speciality', id: 'терапевт', title: 'Терапевт', meta: { doctorIds: [12], clinicIds: [3] } },
  {
    kind: 'service', id: '100', title: 'МРТ головного мозга',
    meta: { selfBooking: false, atDoctorVisit: false, direction: 'Невролог', clinics: [{ id: 3, name: 'Русское поле', price: 4400 }], clinicIds: [3] },
  },
  {
    kind: 'service', id: '101', title: 'Ультразвуковое исследование щитовидной железы',
    meta: { selfBooking: true, atDoctorVisit: false, direction: 'УЗИ', clinics: [{ id: 3, name: 'Русское поле', price: 1500 }], clinicIds: [3] },
  },
  {
    kind: 'service', id: '102', title: 'Консультация невролога первичная',
    meta: { selfBooking: true, atDoctorVisit: true, direction: 'Невролог', clinics: [{ id: 3, name: 'Русское поле', price: 2000 }], clinicIds: [3] },
  },
];

const fakeSearch = {
  async search(_net: number, query: string, opts: { kinds: string[] }): Promise<SearchHit[]> {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).map((w) => (w === 'узи' ? 'ультр' : w.slice(0, 5)));
    return CATALOG.filter((d) => opts.kinds.includes(d.kind))
      .map((d) => ({ d, n: words.filter((w) => d.title.toLowerCase().includes(w)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .map(({ d, n }) => ({
        kind: d.kind, entityId: d.id, title: d.title, score: 0.03 * n, trgm: 0.5,
        coverage: n / Math.max(1, words.length), vecSim: null, prefix: false, ranks: { fts: 1, trgm: 1, vector: null }, meta: d.meta,
      }));
  },
};

// ── Расписание и запись ────────────────────────────────────────────────────
function slot(doctorId: number | undefined, date: string, time: string, label: string, serviceId?: number): Slot {
  return {
    start: `${date}T${time}:00`, end: null, date, time, dateLabel: label, clinicId: 3, clinicName: 'Русское поле',
    doctorId, doctorName: doctorId === 10 ? 'Нестерова Ольга Ивановна' : doctorId === 11 ? 'Петров Пётр Петрович' : undefined, serviceId,
  };
}

const SCHEDULE: Slot[] = [
  slot(10, '2026-11-19', '14:30', 'Завтра'),
  slot(10, '2026-11-19', '15:00', 'Завтра'),
  slot(10, '2026-11-21', '10:00', 'Суббота, 21 ноября'),
  slot(10, '2026-11-21', '11:30', 'Суббота, 21 ноября'),
  slot(11, '2026-11-18', '16:30', 'Сегодня'),
  slot(11, '2026-11-18', '08:00', 'Сегодня'),
  slot(undefined, '2026-11-19', '09:00', 'Завтра', 101),
];

function fakeBooking(over: Partial<BookingPort> = {}): BookingPort & { calls: Record<string, any[]> } {
  const calls: Record<string, any[]> = { book: [], cancel: [], operator: [], reschedule: [] };
  const port: BookingPort = {
    mis: 'local',
    clinicNetId: 2,
    capabilities: () => ({ serviceBooking: true, visitServices: true, patientAppointments: 'client_id', guestBooking: true, guestRequiredFields: ['fullName', 'phone', 'birthday'], reschedule: 'atomic' }),
    async findSlots(q) {
      let s = SCHEDULE.filter((x) => (q.doctorId ? x.doctorId === q.doctorId : x.serviceId === q.serviceId));
      if (q.mode === 'day' && q.date) s = s.filter((x) => x.date === q.date);
      else if (q.mode === 'week' && q.date) s = s.filter((x) => x.date >= q.date!);
      else if (s.length) s = s.filter((x) => x.date === s.sort((a, b) => a.start.localeCompare(b.start))[0].date);
      return s.sort((a, b) => a.start.localeCompare(b.start));
    },
    async visitServices(doctorId) {
      return doctorId === 10
        ? [
            { id: 500, name: 'Приём невролога первичный', price: 2000, priceFrom: false, clinicId: 3, clinicName: 'Русское поле' },
            { id: 501, name: 'Приём невролога повторный', price: 1500, priceFrom: false, clinicId: 3, clinicName: 'Русское поле' },
          ]
        : [];
    },
    async book(r) { calls.book.push(r); return { status: 'booked', appointmentRef: 'doctor:1', message: 'ok' }; },
    async cancel(ref) { calls.cancel.push(ref); return { success: true, message: 'ok' }; },
    async reschedule(ref, r) { calls.reschedule.push({ ref, r }); return { status: 'booked', appointmentRef: 'doctor:2', message: 'ok' }; },
    async patientAppointments() { return []; },
    async createOperatorRequest(i) { calls.operator.push(i); return { success: true, id: 1, message: 'ok' }; },
    ...over,
  };
  return Object.assign(port, { calls });
}

// ── Движок с фейковым NLU ──────────────────────────────────────────────────
function setup(nluScript: Record<string, Frame>, booking = fakeBooking(), clientId?: number) {
  const llmCalls: string[] = [];
  const deps: EngineDeps = {
    nlu: {
      async parse(text: string, ctx: any) {
        const r = parseByRules(text, ctx.expectation);
        if (r) return { frame: r, source: 'rules' };
        llmCalls.push(text);
        return { frame: nluScript[text] ?? { goal: 'other', entities: {} }, source: 'llm', usage: { promptTokens: 800, completionTokens: 40, totalTokens: 840 } };
      },
    },
    answers: {
      async answer() { return { text: 'ответ', usage: [], promptHash: 'h', task: 'answer' }; },
      async symptoms(_c: string, spec: string) { llmCalls.push(`symptoms:${spec}`); return { text: `Стоит обратиться к специалисту «${spec}».`, usage: [], promptHash: 'h', task: 'symptoms' }; },
      async agent(q: string) { llmCalls.push(`agent:${q}`); return { text: 'ответ агента', usage: [], promptHash: 'h', task: 'agent' }; },
    },
    search: fakeSearch,
    adapters: async () => ({ mis: 'local', booking, catalog: { clinicNetId: 2, clinics: async () => [{ id: 3, name: 'Русское поле', address: 'Чехова, 357А', phone: null }] } as any }),
    profile: (id) => profiles.forNet(id),
    now: () => NOW,
  };
  const engine = new DialogEngine(deps);
  const session: DialogSession = { id: 's1', clinicNetId: 2, clientId, provider: 'qwen3', state: emptyState(), messages: [], updatedAt: 0 };
  const say = (text: string, payload?: string) => engine.handle(session, { text, payload });
  return { engine, session, say, booking, llmCalls };
}

describe('DialogEngine: сценарии', () => {
  it('«к Нестеровой на четверг в 15:00» — сразу к типу приёма; модель вызвана один раз', async () => {
    const { say, booking, llmCalls } = setup({
      'Запишите к Нестеровой на четверг в 15:00': { goal: 'book', subject: 'doctor', entities: { doctorName: 'Нестерова', dayOfWeek: 'thu', time: '15:00' } },
    });
    let r = await say('Запишите к Нестеровой на четверг в 15:00');
    expect(r.text).toContain('первичный или повторный');
    expect(r.quickReplies?.map((q) => q.label)).toEqual(['Первичный', 'Повторный']);

    r = await say('первичный');
    expect(r.text).toContain('ФИО, телефон и дату рождения');

    r = await say('Иванова Мария Петровна, 8 900 123-45-67, 01.02.1990');
    expect(r.text).toContain('Подтверждаете запись?');
    expect(r.text).toContain('Нестерова Ольга Ивановна');
    expect(r.text).toContain('Завтра, 15:00');

    r = await say('да');
    expect(r.text).toContain('Вы записаны');
    expect(booking.calls.book[0]).toMatchObject({
      doctorId: 10, visitServiceId: 500,
      slot: { start: '2026-11-19T15:00:00' },
      patient: { data: { lastName: 'Иванова', phone: '79001234567', birthday: '1990-02-01' } },
    });
    expect(llmCalls).toEqual(['Запишите к Нестеровой на четверг в 15:00']);
  });

  it('занятое время — ближайшие варианты, выбор кнопкой', async () => {
    const { say } = setup({
      'к Нестеровой завтра в 12:00': { goal: 'book', entities: { doctorName: 'Нестерова', relativeDay: 'tomorrow', time: '12:00' } },
    });
    const r = await say('к Нестеровой завтра в 12:00');
    expect(r.text).toContain('В 12:00 уже занято');
    expect(r.text).toContain('14:30');
    const r2 = await say('', 'choice:1');
    expect(r2.text).toContain('первичный или повторный');
  });

  it('«Работает ли Нестерова в субботу?» — слоты субботы, выбор ведёт в запись', async () => {
    const { say, session } = setup({
      'Работает ли Нестерова в субботу?': { goal: 'info', question: 'schedule', entities: { doctorName: 'Нестерова', dayOfWeek: 'sat' } },
    });
    const r = await say('Работает ли Нестерова в субботу?');
    expect(r.text).toContain('Суббота, 21 ноября 10:00');
    expect(r.text).toContain('Суббота, 21 ноября 11:30');
    const r2 = await say('давайте 11:30');
    expect(session.state.goal).toBe('book');
    expect(session.state.slot?.time).toBe('11:30');
    expect(r2.text).toContain('первичный или повторный');
  });

  it('«Можно прийти сейчас с болью в животе?» — текст про жалобу + сегодняшние слоты гастроэнтеролога после текущего часа', async () => {
    const { say, llmCalls } = setup({
      'Можно прийти сейчас с болью в животе?': { goal: 'book', subject: 'symptom', entities: { symptom: 'боль в животе', now: true } },
    });
    const r = await say('Можно прийти сейчас с болью в животе?');
    expect(r.text).toContain('«Гастроэнтеролог»');
    expect(r.text).toContain('Петров П. П., Сегодня 16:30');
    expect(r.text).not.toContain('08:00');
    expect(llmCalls).toEqual(['Можно прийти сейчас с болью в животе?', 'symptoms:Гастроэнтеролог']);
  });

  it('услуга по направлению: есть направление → данные → заявка администратору', async () => {
    const { say, booking } = setup({ 'Хочу на МРТ головного мозга': { goal: 'book', subject: 'service', entities: { serviceQuery: 'МРТ головного мозга' } } });
    let r = await say('Хочу на МРТ головного мозга');
    expect(r.text).toContain('нужно направление');
    r = await say('да');
    expect(r.text).toContain('ФИО');
    r = await say('Петрова Анна 89001234567 5 марта 1985');
    expect(r.text).toContain('заявка');
    expect(booking.calls.operator[0]).toMatchObject({ serviceId: 100, patient: { data: { lastName: 'Петрова' } } });
  });

  it('без направления — предложение записаться к врачу направления', async () => {
    const { say, session } = setup({ 'Хочу на МРТ головного мозга': { goal: 'book', entities: { serviceQuery: 'МРТ головного мозга' } } });
    await say('Хочу на МРТ головного мозга');
    const r = await say('нет');
    expect(r.text).toContain('Записать Вас на приём (Невролог)?');
    const r2 = await say('да');
    expect(session.state.target).toMatchObject({ kind: 'speciality', doctorIds: [10] });
    expect(r2.text).toContain('Нестерова');
  });

  it('конфликт: заменить старую запись', async () => {
    let first = true;
    const booking = fakeBooking({
      async book(r) {
        booking.calls.book.push(r);
        if (first) { first = false; return { status: 'conflict', existingRef: 'service:7', description: '19 ноя, 09:00 на УЗИ', message: '' }; }
        return { status: 'booked', appointmentRef: 'service:8', message: 'ok' };
      },
    });
    const { say } = setup({ 'УЗИ щитовидной завтра в 9:00': { goal: 'book', entities: { serviceQuery: 'щитовидной железы', relativeDay: 'tomorrow', time: '09:00' } } }, booking, 42);
    let r = await say('УЗИ щитовидной завтра в 9:00');
    expect(r.text).toContain('Подтверждаете запись?');
    r = await say('да');
    expect(r.text).toContain('уже есть запись');
    r = await say('', 'choice:1');
    expect(booking.calls.cancel).toEqual(['service:7']);
    expect(r.text).toContain('Вы записаны');
  });

  it('отмена: «отмените запись на завтра» и запись на пятницу в той же реплике', async () => {
    const appts: Appointment[] = [
      { ref: 'doctor:5', kind: 'doctor', date: '2026-11-19', time: '15:00', clinicId: 3, clinicName: 'Русское поле', doctorId: 10, doctorName: 'Нестерова Ольга Ивановна', speciality: 'Невролог' },
      { ref: 'doctor:6', kind: 'doctor', date: '2026-11-25', time: '10:00', clinicId: 3, clinicName: 'Русское поле', doctorId: 11, doctorName: 'Петров Пётр Петрович' },
    ];
    const booking = fakeBooking({ patientAppointments: async () => appts });
    const { say } = setup({
      'отмените запись на завтра и запишите к неврологу на субботу': {
        goal: 'cancel', entities: { relativeDay: 'tomorrow' },
        next: [{ goal: 'book', entities: { speciality: 'невролог', dayOfWeek: 'sat' } }],
      },
    }, booking, 42);
    let r = await say('отмените запись на завтра и запишите к неврологу на субботу');
    expect(r.text).toContain('Отменить запись: 19 ноября 15:00');
    r = await say('да');
    expect(booking.calls.cancel).toEqual(['doctor:5']);
    expect(r.text).toContain('Запись отменена.');
    expect(r.text).toContain('Суббота, 21 ноября');
  });

  it('гость не видит записей', async () => {
    const { say } = setup({});
    const r = await say('мои записи');
    expect(r.text).toContain('личный кабинет');
  });

  it('экстренное — без модели, 103/112', async () => {
    const { say, llmCalls } = setup({});
    const r = await say('у папы резкая боль в груди, задыхается');
    expect(r.text).toContain('103');
    expect(llmCalls).toEqual([]);
  });

  it('непонятное — запасной агент', async () => {
    const { say, llmCalls } = setup({});
    const r = await say('Примете направление из другой клиники?');
    expect(r.text).toBe('ответ агента');
    expect(llmCalls).toContain('agent:Примете направление из другой клиники?');
  });

  it('кнопка со стенда: book:service:<название> — без модели', async () => {
    const { say, llmCalls } = setup({});
    const r = await say('Хочу записаться на услугу "Ультразвуковое исследование щитовидной железы"', 'book:service:Ультразвуковое исследование щитовидной железы');
    expect(r.text).toContain('Завтра 09:00');
    expect(llmCalls).toEqual([]);
  });
});

describe('DialogEngine: вопрос посреди записи', () => {
  it('кнопка консультации, затем «на субботу есть места?» — слоты субботы того же врача, не агент', async () => {
    const { say, llmCalls, session } = setup({
      'на субботу есть места?': { goal: 'info', question: 'schedule', entities: { dayOfWeek: 'sat' } },
    });
    const r1 = await say('Хочу записаться на услугу "Консультация невролога первичная"', 'book:service:Консультация невролога первичная');
    expect(r1.text).not.toContain('выполняется на приёме');
    expect(r1.text).toContain('14:30');
    const r2 = await say('на субботу есть места?');
    expect(r2.text).toContain('Суббота, 21 ноября');
    expect(llmCalls.filter((c) => c.startsWith('agent:'))).toEqual([]);
    expect(session.state.goal).toBe('book');
  });
});

describe('DialogEngine: модель повторяет выбранное из контекста', () => {
  it('кнопка «Консультация невролога первичная», затем день — модель вернула «консультация невролога»: без переспроса услуги', async () => {
    const { say, session } = setup({
      'хочу в субботу': { goal: 'book', entities: { serviceQuery: 'консультация невролога', speciality: 'невролог', dayOfWeek: 'sat' } },
    });
    await say('Хочу записаться на услугу "Консультация невролога первичная"', 'book:service:Консультация невролога первичная');
    const r = await say('хочу в субботу');
    expect(r.text).not.toContain('Уточните');
    expect(r.text).toContain('Суббота, 21 ноября');
    expect(session.state.entities.serviceQuery).toBe('Консультация невролога первичная');
  });

  it('синоним выбранной услуги («узи щитовидки») — выбор не сбрасывается (проверка поиском)', async () => {
    const { say, session } = setup({
      'а в субботу можно?': { goal: 'book', entities: { serviceQuery: 'узи щитовидки', dayOfWeek: 'sat' } },
    });
    await say('Хочу записаться на услугу "Ультразвуковое исследование щитовидной железы"', 'book:service:Ультразвуковое исследование щитовидной железы');
    const r = await say('а в субботу можно?');
    expect(r.text).not.toContain('Уточните');
    expect(session.state.target).toMatchObject({ kind: 'service', serviceId: 101 });
    expect(session.state.entities.serviceQuery).toBe('Ультразвуковое исследование щитовидной железы');
  });

  it('другая услуга при выбранной — смена выбора', async () => {
    const { say, session } = setup({
      'а лучше на УЗИ щитовидной железы': { goal: 'book', entities: { serviceQuery: 'УЗИ щитовидной железы' } },
    });
    await say('Хочу записаться на услугу "Консультация невролога первичная"', 'book:service:Консультация невролога первичная');
    const r = await say('а лучше на УЗИ щитовидной железы');
    expect(r.text).toContain('Завтра 09:00');
    expect(session.state.target).toMatchObject({ kind: 'service', name: 'Ультразвуковое исследование щитовидной железы' });
  });
});

describe('DialogEngine: подтверждение только явное', () => {
  it('«Первичный» в ответ на «Подтверждаете запись?» не записывает, даже если модель вернула reply: yes', async () => {
    const { say, booking } = setup({
      'Запишите к Нестеровой на четверг в 15:00': { goal: 'book', entities: { doctorName: 'Нестерова', dayOfWeek: 'thu', time: '15:00' } },
      'Первичный приём': { reply: 'yes', entities: { visitType: 'primary' } },
    });
    await say('Запишите к Нестеровой на четверг в 15:00');
    await say('повторный');
    let r = await say('Иванова Мария Петровна, 8 900 123-45-67, 01.02.1990');
    expect(r.text).toContain('Подтверждаете запись?');
    r = await say('Первичный приём');
    expect(booking.calls.book).toHaveLength(0);
    expect(r.text).toContain('Подтверждаете запись?');
    expect(r.text).toContain('Первичный');
    r = await say('', 'yes');
    expect(booking.calls.book).toHaveLength(1);
  });

  it('«да» после завершённой записи — не агенту', async () => {
    const { say, llmCalls } = setup({ 'да конечно': { reply: 'yes', entities: {} } });
    const r = await say('да конечно');
    expect(r.text).toBe('Чем ещё могу помочь?');
    expect(llmCalls.filter((c) => c.startsWith('agent:'))).toEqual([]);
  });
});

describe('dates', () => {
  it('«на следующей неделе» без дня — неделя с понедельника', () => {
    const { slotWindow } = require('./dates');
    expect(slotWindow({ nextWeek: true }, NOW)).toEqual({ mode: 'week', date: '2026-11-23' });
    expect(slotWindow({ dayOfWeek: 'wed', nextWeek: true }, NOW)).toEqual({ mode: 'day', date: '2026-11-25' });
    expect(slotWindow({}, NOW)).toEqual({ mode: 'nearest' });
  });
});

describe('DialogEngine: уточнения', () => {
  const mri = (id: number, title: string) => ({
    kind: 'service' as const, id: String(id), title,
    meta: { selfBooking: true, atDoctorVisit: false, direction: 'МРТ', clinics: [{ id: 3, name: 'Русское поле', price: 4000 }], clinicIds: [3] },
  });
  const MRI = [
    mri(201, 'МРТ головного мозга'), mri(202, 'МРТ гипофиза'), mri(203, 'МРТ шейного отдела позвоночника'),
    mri(204, 'МРТ грудного отдела позвоночника'), mri(205, 'МРТ коленного сустава'), mri(206, 'МРТ плечевого сустава'),
    mri(207, 'МРТ органов брюшной полости'), mri(208, 'МРТ почек'), mri(209, 'МРТ мягких тканей'),
  ];

  it('много услуг из разных областей — сначала область, потом услуга', async () => {
    CATALOG.push(...MRI);
    try {
      const { say, session } = setup({});
      let r = await say('Хочу на МРТ', 'book:service:МРТ');
      expect(r.text).toContain('Какую область нужно обследовать?');
      expect(r.quickReplies?.map((q) => q.label)).toEqual(expect.arrayContaining(['Голова и мозг', 'Позвоночник', 'Суставы и кости', 'Другое']));
      r = await say('позвоночник');
      expect(r.text).toContain('МРТ шейного отдела позвоночника');
      expect(r.text).toContain('МРТ грудного отдела позвоночника');
      expect(r.text).not.toContain('коленного');
      r = await say('', 'choice:1');
      expect(session.state.target).toMatchObject({ kind: 'service', name: 'МРТ шейного отдела позвоночника' });
    } finally {
      CATALOG.splice(CATALOG.length - MRI.length, MRI.length);
    }
  });

  it('данные пациента вместо выбора времени — сохраняются, список остаётся', async () => {
    const { say, session } = setup({
      'к Нестеровой': { goal: 'book', entities: { doctorName: 'Нестерова' } },
      'Иванова Мария Петровна, 8 900 123-45-67, 01.02.1990': { entities: { lastName: 'Иванова', firstName: 'Мария', secondName: 'Петровна', phone: '79001234567', birthday: '1990-02-01' } },
    });
    await say('к Нестеровой');
    const r = await say('Иванова Мария Петровна, 8 900 123-45-67, 01.02.1990');
    expect(r.text).toContain('данные сохранила');
    expect(r.text).toContain('Завтра 14:30');
    expect(session.patient).toMatchObject({ lastName: 'Иванова', phone: '79001234567' });
  });

  it('перенос «на другой день» не предлагает ту же дату', async () => {
    const appts: Appointment[] = [
      { ref: 'doctor:5', kind: 'doctor', date: '2026-11-19', time: '14:30', clinicId: 3, clinicName: 'Русское поле', doctorId: 10, doctorName: 'Нестерова Ольга Ивановна' },
    ];
    const booking = fakeBooking({ patientAppointments: async () => appts });
    const { say } = setup({ 'Перенесите запись на другой день': { goal: 'reschedule', entities: {} } }, booking, 42);
    const r = await say('Перенесите запись на другой день');
    expect(r.text).not.toContain('Завтра');
    expect(r.text).toContain('Суббота, 21 ноября');
  });
});

describe('DialogEngine: данные от модели', () => {
  it('телефон и дата рождения из ответа модели приводятся к единому формату', async () => {
    const { say, session } = setup({
      'к Нестеровой': { goal: 'book', entities: { doctorName: 'Нестерова' } },
      'Тестов Тест, 8 999 000-00-00, 1 января 1990': { entities: { lastName: 'Тестов', firstName: 'Тест', phone: '8 999 000-00-00', birthday: '01.01.1990' } },
    });
    await say('к Нестеровой');
    await say('Тестов Тест, 8 999 000-00-00, 1 января 1990');
    expect(session.patient).toMatchObject({ phone: '79990000000', birthday: '1990-01-01' });
  });
});
