/**
 * Цикл 3: многоходовые сценарии (симуляция разных пациентов).
 *
 * MVP-набор из 7 тестов, по одному из ключевых групп плана MULTI_TURN_TEST_PLAN.md:
 *   A1 — смена дня после первого предложения
 *   A2 — уточнение времени суток («вечером»)
 *   B1 — «передумал» после показа сводки
 *   C1 — перенос существующей записи на другой день
 *   D1 — отмена единственной записи
 *   F1 — гостевой режим: данные не сразу полностью
 *   G1 — услуга (УЗИ сердца) → полная запись
 *
 * Каждый тест:
 *   - использует TestContext (ctx.user('msg'))
 *   - имеет HARD-ассерты для детерминированных проверок
 *   - даёт ctx собрать диалог и прогнать эвристики
 *   - всё пишется в tests/results/cycle3/<test>.md
 *
 * После прогона смотрим INDEX.md и отдельные отчёты для семантического ревью.
 */

import {
  test, runAll, setCycle, resetMock, TestContext,
  nearestWeekday, nextWeekDay, toIso, expectSlotDate, expectSlotDateInRange, expectBookingSuccess,
  TEST_PATIENT_LINE,
  readMockAppointments, activeMockAppointments, hasSuccessfulBooking,
} from './lib';

setCycle('cycle3');
resetMock();

// ── A1. Отказ от слота → другой день ────────────────────────────────────────

test(
  'A1 — отказ от среды → пятница',
  'Пациент просит запись в среду, бот предлагает, пациент уточняет «а есть на пятницу?», получает другие слоты, выбирает, доводит до записи.',
  async (ctx: TestContext) => {
    resetMock();
    const wed = nearestWeekday(3);
    const fri = nearestWeekday(5);

    const r1 = await ctx.user('Запиши меня к терапевту в среду');
    // Первый поиск — на среду.
    try { expectSlotDate(r1.history, toIso(wed)); }
    catch (e: any) { ctx.fail(`Turn 1: ${e.message}`); }

    const r2 = await ctx.user('А есть на пятницу?');
    try { expectSlotDate(r2.history, toIso(fri)); }
    catch (e: any) { ctx.fail(`Turn 2: ${e.message}`); }

    await ctx.user('Возьму первый предложенный вариант');
    await ctx.user(TEST_PATIENT_LINE);
    const r5 = await ctx.user('Подтверждаю');

    try { expectBookingSuccess(r5.history); }
    catch (e: any) { ctx.fail(`Финальный booking: ${e.message}`); }

    // Финальный startTime должен быть на пятницу.
    const lastBookArgs = r5.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (lastBookArgs?.function_call) {
      try {
        const args = JSON.parse(lastBookArgs.function_call.arguments);
        if (args.startTime && !args.startTime.startsWith(toIso(fri))) {
          ctx.fail(`book_appointment.startTime="${args.startTime}", ожидали ${toIso(fri)}* (пятница)`);
        }
      } catch { /* ignore */ }
    }
  },
);

// ── A2. Уточнение времени суток («вечером») ────────────────────────────────

test(
  'A2 — уточнение «вечером» после общего запроса на вторник',
  'Пациент запрашивает Вт, бот предлагает (Петров: 10:00–17:30), пациент уточняет «а вечером?», выбирает вечерний слот.',
  async (ctx: TestContext) => {
    resetMock();
    const tue = nearestWeekday(2);

    const r1 = await ctx.user('Запиши меня к терапевту во вторник');
    try { expectSlotDate(r1.history, toIso(tue)); }
    catch (e: any) { ctx.fail(`Turn 1: ${e.message}`); }

    await ctx.user('А есть на вечернее время?');
    await ctx.user('Беру в 17:00');
    await ctx.user(TEST_PATIENT_LINE);
    const r5 = await ctx.user('Подтверждаю');

    try { expectBookingSuccess(r5.history); }
    catch (e: any) { ctx.fail(`Финальный booking: ${e.message}`); }

    // Проверка: финальный startTime во вторник, HH ≥ 16.
    const lastBookArgs = r5.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (lastBookArgs?.function_call) {
      try {
        const args = JSON.parse(lastBookArgs.function_call.arguments);
        if (args.startTime) {
          // Поддерживаем оба формата: "2026-05-26T17:00:00" и "2026-05-26 17:00".
          const hourMatch = String(args.startTime).match(/[T\s](\d{2}):/);
          const hour = hourMatch ? parseInt(hourMatch[1], 10) : -1;
          if (hour < 16) ctx.fail(`startTime hour=${hour}, ожидали ≥ 16 (вечер)`);
          if (!String(args.startTime).startsWith(toIso(tue))) ctx.fail(`startTime="${args.startTime}", ожидали ${toIso(tue)}* (вторник)`);
        }
      } catch { /* ignore */ }
    }
  },
);

// ── B1. «Передумал» после сводки ────────────────────────────────────────────

test(
  'B1 — отказ после сводки',
  'Пациент проходит весь flow, при «Подтверждаете?» отвечает «Нет, передумал». Запись не должна быть создана.',
  async (ctx: TestContext) => {
    resetMock();
    const wed = nearestWeekday(3);

    const r1 = await ctx.user('Запиши меня к терапевту в среду');
    try { expectSlotDate(r1.history, toIso(wed)); }
    catch (e: any) { ctx.fail(`Turn 1: ${e.message}`); }

    await ctx.user('Возьму первый предложенный вариант');
    await ctx.user(TEST_PATIENT_LINE);
    // На сводке отказываемся.
    const r4 = await ctx.user('Нет, передумал');

    // HARD: в истории НЕ должно быть book_appointment.success=true
    const hasSuccess = r4.history.some(m => {
      if (m.role !== 'function' || m.name !== 'book_appointment') return false;
      try { return JSON.parse(m.content).success === true; } catch { return false; }
    });
    if (hasSuccess) ctx.fail('book_appointment.success=true в истории — пациент передумал, не должно быть записи');
  },
);

// ── C1. Перенос записи на другой день ──────────────────────────────────────

test(
  'C1 — запись в среду → перенос на пятницу',
  'Пациент создаёт запись, потом просит перенести на другой день. Старая отменяется, новая создаётся.',
  async (ctx: TestContext) => {
    resetMock();
    const wed = nearestWeekday(3);
    const fri = nearestWeekday(5);

    // Setup: создаём запись на среду
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первый предложенный вариант');
    await ctx.user(TEST_PATIENT_LINE);
    const r4 = await ctx.user('Подтверждаю');
    try { expectBookingSuccess(r4.history); }
    catch (e: any) { ctx.fail(`Setup booking: ${e.message}`); }
    ctx.note('Запись на среду создана');

    // Переносим на пятницу
    const r5 = await ctx.user('А давай перенесём на пятницу');
    try { expectSlotDate(r5.history, toIso(fri)); }
    catch (e: any) { ctx.flag(`После «перенесём» slot на пятницу не нашёлся: ${e.message}`); }

    await ctx.user('Возьму первое время');
    const r7 = await ctx.user('Подтверждаю');

    // HARD: в истории должно быть либо reschedule_appointment.success либо два book + cancel.
    const hasReschedule = r7.history.some(m => {
      if (m.role !== 'function' || m.name !== 'reschedule_appointment') return false;
      try { return JSON.parse(m.content).success === true; } catch { return false; }
    });
    const cancelCalls = r7.history.filter(m => m.role === 'function' && m.name === 'cancel_appointment').length;
    const bookSuccesses = r7.history.filter(m => {
      if (m.role !== 'function' || m.name !== 'book_appointment') return false;
      try { return JSON.parse(m.content).success === true; } catch { return false; }
    }).length;

    if (!hasReschedule && !(cancelCalls >= 1 && bookSuccesses >= 2)) {
      ctx.fail(`Перенос не сработал: reschedule=${hasReschedule}, cancels=${cancelCalls}, bookSuccesses=${bookSuccesses}`);
    }
  },
);

// ── D1. Отмена единственной записи ──────────────────────────────────────────

test(
  'D1 — отмена единственной записи',
  'Пациент создаёт запись, потом просит её отменить. Ожидается, что запись помечена canceled.',
  async (ctx: TestContext) => {
    resetMock();
    const wed = nearestWeekday(3);

    // Setup
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первый предложенный вариант');
    await ctx.user(TEST_PATIENT_LINE);
    const r4 = await ctx.user('Подтверждаю');
    try { expectBookingSuccess(r4.history); }
    catch (e: any) { ctx.fail(`Setup booking: ${e.message}`); }

    // Отмена
    await ctx.user('Отмени мою запись');
    const r6 = await ctx.user('Да, отменяю');

    const canceledOk = r6.history.some(m => {
      if (m.role !== 'function' || m.name !== 'cancel_appointment') return false;
      try { return JSON.parse(m.content).success === true; } catch { return false; }
    });
    if (!canceledOk) ctx.fail('cancel_appointment.success=true не найдено в истории');
  },
);

// ── F1. Гостевой режим: данные не сразу полностью ──────────────────────────

test(
  'F1 — данные пациента не сразу полностью',
  'Гостевой режим. Пациент даёт только ФИО, бот переспрашивает телефон и ДР. После полных данных — запись создаётся.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Запиши меня к терапевту на пятницу');
    await ctx.user('Возьму первое время');
    // Даём только часть данных.
    await ctx.user('Иванов Иван Иванович');
    // Бот должен переспросить телефон/ДР.
    await ctx.user('79991234567, 1 января 1990');
    const r5 = await ctx.user('Подтверждаю');

    try { expectBookingSuccess(r5.history); }
    catch (e: any) { ctx.fail(`Финальный booking: ${e.message}`); }

    // Проверка: в args финального book_appointment нет плейсхолдеров.
    const lastBookSuccess = r5.history.filter(m => m.role === 'function' && m.name === 'book_appointment').pop();
    const idx = lastBookSuccess ? r5.history.indexOf(lastBookSuccess) : -1;
    if (idx > 0) {
      const argsMsg = r5.history[idx - 1];
      if (argsMsg.function_call) {
        try {
          const args = JSON.parse(argsMsg.function_call.arguments);
          const phone = String(args.phone ?? '');
          if (!/^\d{10,11}$/.test(phone.replace(/\D/g, ''))) {
            ctx.fail(`Финальный phone="${phone}" — невалидный формат`);
          }
        } catch { /* ignore */ }
      }
    }
  },
);

// ── G1. Услуга «УЗИ сердца» → запись ───────────────────────────────────────

test(
  'G1 — УЗИ сердца, полная запись',
  'Пациент просит записать на УЗИ сердца. Бот находит услугу, врача (Соколов УЗИ), даёт слоты, доводит до записи. Финальная цена = 3500, specialityId = 10 (Врач УЗИ).',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Хочу записаться на УЗИ сердца');
    await ctx.user('Возьму ближайший вариант');
    await ctx.user(TEST_PATIENT_LINE);
    const r4 = await ctx.user('Подтверждаю');

    // Проверяем за весь диалог через ctx.turns — r4.history не годится, т.к.
    // compactSearchResults после успешного booking стирает find_services pair.
    const hasUziDoc = ctx.turns.some(t =>
      t.toolCalls.some(tc =>
        tc.name === 'find_services' && Array.isArray(tc.result) &&
        tc.result.some((r: any) => r.doctorId === 1008 || (r.serviceName ?? '').includes('УЗИ'))
      )
    );
    if (!hasUziDoc) ctx.fail('Не нашли врача УЗИ / услугу «УЗИ сердца» в результате find_services');

    try { expectBookingSuccess(r4.history); }
    catch (e: any) { ctx.fail(`Финальный booking: ${e.message}`); }

    // HARD: specialityId=10, price=3500.
    const lastBookCall = r4.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (lastBookCall?.function_call) {
      try {
        const args = JSON.parse(lastBookCall.function_call.arguments);
        if (args.specialityId !== 10) ctx.fail(`specialityId=${args.specialityId}, ожидали 10 (Врач УЗИ)`);
        if (args.price !== 3500) ctx.fail(`price=${args.price}, ожидали 3500 (УЗИ сердца)`);
        if (args.doctorId !== 1008) ctx.fail(`doctorId=${args.doctorId}, ожидали 1008 (Соколов)`);
      } catch { /* ignore */ }
    }
  },
);

// ── Расширенный набор (приоритет 1) ────────────────────────────────────────

// ── A3. Конкретное время после общего запроса ──────────────────────────────

test(
  'A3 — конкретное время «в 11:00» после общего запроса',
  'Запрос среды, бот предлагает диапазон, пациент уточняет «А в 11:00 свободно?», выбирает, доводит до записи.',
  async (ctx: TestContext) => {
    resetMock();
    const wed = nearestWeekday(3);
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('А в 11:00 свободно?');
    await ctx.user(TEST_PATIENT_LINE);
    const r4 = await ctx.user('Подтверждаю');
    try { expectBookingSuccess(r4.history); } catch (e: any) { ctx.fail(`booking: ${e.message}`); }

    // HARD: финальный startTime — 11:00 в среду.
    const last = r4.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (last?.function_call) {
      try {
        const args = JSON.parse(last.function_call.arguments);
        if (!String(args.startTime ?? '').startsWith(toIso(wed))) ctx.fail(`startTime="${args.startTime}", ожидали ${toIso(wed)}*`);
        if (!String(args.startTime ?? '').includes('11:00')) ctx.fail(`startTime="${args.startTime}", ожидали 11:00`);
      } catch { /* ignore */ }
    }
  },
);

// ── A4. Смена врача явно ────────────────────────────────────────────────────

test(
  'A4 — смена врача (к Петрову в субботу)',
  'Запрос в субботу к терапевту, бот предлагает Петрова (Иванова не работает Сб). Пациент: «К Петрову в 10:00».',
  async (ctx: TestContext) => {
    resetMock();
    const sat = nearestWeekday(6);
    await ctx.user('Запиши меня к терапевту в субботу');
    await ctx.user('К Петрову возьму в 10:00');
    await ctx.user(TEST_PATIENT_LINE);
    const r4 = await ctx.user('Подтверждаю');
    try { expectBookingSuccess(r4.history); } catch (e: any) { ctx.fail(`booking: ${e.message}`); }

    const last = r4.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (last?.function_call) {
      try {
        const args = JSON.parse(last.function_call.arguments);
        if (args.doctorId !== 1004) ctx.fail(`doctorId=${args.doctorId}, ожидали 1004 (Петров)`);
        if (!String(args.startTime ?? '').startsWith(toIso(sat))) ctx.fail(`startTime="${args.startTime}", ожидали ${toIso(sat)}*`);
      } catch { /* ignore */ }
    }
  },
);

// ── A5. Смена услуги в процессе ────────────────────────────────────────────

test(
  'A5 — смена услуги (ботокс → чистка лица)',
  'Запрос на ботокс, потом «нет, лучше на чистку лица», бот переключается, доводит до записи.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Хочу записаться на ботокс');
    await ctx.user('Нет, лучше на чистку лица');
    await ctx.user('Возьму первое предложенное время');
    await ctx.user(TEST_PATIENT_LINE);
    const r5 = await ctx.user('Подтверждаю');
    try { expectBookingSuccess(r5.history); } catch (e: any) { ctx.fail(`booking: ${e.message}`); }

    // HARD: финальная цена ~ 3400 (Чистка), не 11500 (Ботокс).
    const last = r5.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (last?.function_call) {
      try {
        const args = JSON.parse(last.function_call.arguments);
        if (args.price === 11500) ctx.fail(`price=11500 (Ботокс), ожидали ≠ — должна быть Чистка`);
        if (args.specialityId !== 9) ctx.fail(`specialityId=${args.specialityId}, ожидали 9 (Косметолог)`);
      } catch { /* ignore */ }
    }
  },
);

// ── B2. Отказ после ввода данных ───────────────────────────────────────────

test(
  'B2 — отказ после ввода данных пациента',
  'Пациент даёт данные, видит сводку, говорит «Стоп, не надо». Запись не должна быть создана.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первый предложенный вариант');
    await ctx.user(TEST_PATIENT_LINE);
    const r4 = await ctx.user('Стоп, не надо записываться');

    const hasSuccess = r4.history.some(m => {
      if (m.role !== 'function' || m.name !== 'book_appointment') return false;
      try { return JSON.parse(m.content).success === true; } catch { return false; }
    });
    if (hasSuccess) ctx.fail('book_appointment.success=true в истории — пациент отказался после ввода данных, не должно быть записи');
  },
);

// ── C2. Перенос на тот же день, другое время ──────────────────────────────

test(
  'C2 — перенос времени в рамках того же дня',
  'Создаём запись на среду 09:00, переносим на 14:00 в среду же.',
  async (ctx: TestContext) => {
    resetMock();
    const wed = nearestWeekday(3);

    // setup
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму 09:00');
    await ctx.user(TEST_PATIENT_LINE);
    const r4 = await ctx.user('Подтверждаю');
    try { expectBookingSuccess(r4.history); } catch (e: any) { ctx.fail(`setup: ${e.message}`); }
    ctx.note('Setup booking на 09:00 готов');

    // reschedule
    await ctx.user('А давай перенесём на 14:00 в этот же день');
    const r6 = await ctx.user('Подтверждаю');

    // HARD: в моке должна быть одна активная запись на новое время.
    const active = activeMockAppointments();
    if (active.length !== 1) ctx.fail(`в моке активных записей=${active.length}, ожидали 1`);
    const a = active[0];
    if (a && !a.dt_start.startsWith(toIso(wed))) ctx.fail(`dt_start="${a?.dt_start}", ожидали ${toIso(wed)}*`);
    if (a && !a.dt_start.includes('14:00')) ctx.fail(`dt_start="${a?.dt_start}", ожидали 14:00`);
  },
);

// ── C4. Несколько записей — уточнение какую переносить ─────────────────────

test(
  'C4 — две записи, уточнение какую переносить',
  'Создаём две записи (терапевт + косметолог). «Перенеси мою запись» → бот уточняет какую.',
  async (ctx: TestContext) => {
    resetMock();
    // setup 1: терапевт
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первое');
    await ctx.user(TEST_PATIENT_LINE);
    await ctx.user('Подтверждаю');

    // setup 2: косметолог
    await ctx.user('А ещё запиши к косметологу в пятницу');
    await ctx.user('Возьму первое');
    await ctx.user('Подтверждаю');

    const beforeReschedule = activeMockAppointments().length;
    if (beforeReschedule < 2) ctx.note(`Setup: активных записей=${beforeReschedule} (ожидали 2)`);

    // user просит перенести без уточнения
    const r = await ctx.user('Перенеси запись');

    // Soft check: бот должен уточнить (вопрос про «какую» / «к кому» / название).
    if (!/каку|какую|к\s+ком|какая|терапе|косметол/i.test(r.reply)) {
      ctx.flag(`Бот не уточнил какую запись переносить: ${r.reply.slice(0, 200)}`);
    }
  },
);

// ── D2. Отмена при нескольких записях — выбор какой ────────────────────────

test(
  'D2 — две записи, отмена терапевта (выбор)',
  'Создаём две записи (терапевт + косметолог). «Отмени запись к терапевту» — должна отмениться именно терапевтическая, косметолог не тронут.',
  async (ctx: TestContext) => {
    resetMock();
    // setup 1
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первое');
    await ctx.user(TEST_PATIENT_LINE);
    await ctx.user('Подтверждаю');

    // setup 2
    await ctx.user('Также запиши к косметологу в пятницу');
    await ctx.user('Возьму первое');
    await ctx.user('Подтверждаю');

    const setupActive = activeMockAppointments();
    if (setupActive.length !== 2) {
      ctx.flag(`Setup: активных записей=${setupActive.length}, ожидали 2 — D2 может быть неточным`);
    }

    // отмена терапевта
    await ctx.user('Отмени запись к терапевту');
    await ctx.user('Да, отменяю');

    const final = activeMockAppointments();
    // Должна остаться только одна — косметология (speciality_id=9).
    const remainingTherapists = final.filter(a => a.speciality_id === 1);
    const remainingCosm = final.filter(a => a.speciality_id === 9);
    if (remainingTherapists.length > 0) ctx.fail(`Активная запись к терапевту осталась после отмены`);
    if (remainingCosm.length === 0) ctx.fail(`Запись к косметологу пропала — должна остаться`);
  },
);

// ── D3. Отмена по имени врача ──────────────────────────────────────────────

test(
  'D3 — отмена «к Петрову» по имени врача',
  'Запись к Петрову, потом «Отмени запись к Петрову». Должна отмениться именно эта.',
  async (ctx: TestContext) => {
    resetMock();
    // setup: запись к Петрову в субботу
    await ctx.user('Запиши меня к терапевту в субботу');
    await ctx.user('Возьму первый вариант');
    await ctx.user(TEST_PATIENT_LINE);
    await ctx.user('Подтверждаю');

    // отмена
    await ctx.user('Отмени запись к Петрову');
    await ctx.user('Да, подтверждаю');

    const active = activeMockAppointments();
    const petrovActive = active.filter(a => a.doctor_id === 1004);
    if (petrovActive.length > 0) ctx.fail(`Запись к Петрову активна, ожидали отменена`);
  },
);

// ── D4. Отказ от отмены ─────────────────────────────────────────────────────

test(
  'D4 — отказ от отмены',
  'Пациент: «Отмени», бот спрашивает, пациент: «Передумал, оставлю». Запись не должна быть отменена.',
  async (ctx: TestContext) => {
    resetMock();
    // setup
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первое');
    await ctx.user(TEST_PATIENT_LINE);
    await ctx.user('Подтверждаю');

    const before = activeMockAppointments().length;

    // попытка отмены
    await ctx.user('Отмени мою запись');
    await ctx.user('Передумал, оставлю');

    const after = activeMockAppointments().length;
    if (after !== before) ctx.fail(`Записей было=${before}, стало=${after}, но отмена должна была быть прервана`);
  },
);

// ── E1. Конфликт записи → «заменить» ───────────────────────────────────────

test(
  'E1 — двойная запись на одно время → заменить',
  'Запись на среду 09:00, потом попытка на ту же среду 09:00 → MedFlex 409 → пациент: «Заменить». Старая отменяется, новая создаётся.',
  async (ctx: TestContext) => {
    resetMock();
    // setup
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму в 09:00');
    await ctx.user(TEST_PATIENT_LINE);
    await ctx.user('Подтверждаю');

    // повторная попытка на то же время
    await ctx.user('Запиши снова к терапевту в среду в 09:00');
    await ctx.user('Заменить');

    // в финале — одна активная запись (старая отменена, новая создана —
    // на 09:00 если был реальный 409, или на ближайший доступный слот среды если
    // мок предфильтрует занятые слоты).
    const active = activeMockAppointments();
    const wed = nearestWeekday(3);
    const wedActive = active.filter(a => a.dt_start.startsWith(toIso(wed)));
    if (wedActive.length !== 1) ctx.fail(`Активных записей на ${toIso(wed)} = ${wedActive.length}, ожидали 1 (старая отменена, новая создана)`);
  },
);

// ── F2. Кривой телефон → переспрос ─────────────────────────────────────────

test(
  'F2 — некорректный телефон, бот переспрашивает',
  'Пациент даёт ФИО + кривой телефон + ДР. Бот должен переспросить телефон.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первое');
    // Кривой телефон (4 цифры).
    await ctx.user('Тестов Тест Тестович, 1234, 1 января 1990');

    // Бот должен переспросить (не передавать кривой телефон в book_appointment с success).
    await ctx.user('79991234567');
    const r5 = await ctx.user('Подтверждаю');

    try { expectBookingSuccess(r5.history); } catch (e: any) { ctx.fail(`booking: ${e.message}`); }
    // В финальных args телефон валидный.
    const last = r5.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (last?.function_call) {
      try {
        const args = JSON.parse(last.function_call.arguments);
        const digits = String(args.phone ?? '').replace(/\D/g, '');
        if (digits.length < 10) ctx.fail(`Финальный phone="${args.phone}" — невалидный (${digits.length} digits)`);
      } catch { /* ignore */ }
    }
  },
);

// ── F3. Кривая ДР → переспрос ──────────────────────────────────────────────

test(
  'F3 — некорректная ДР, бот переспрашивает',
  'Пациент даёт ФИО + телефон + кривую ДР. Бот переспрашивает.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первое');
    await ctx.user('Тестов Тест Тестович, 79991234567, давно родился');

    await ctx.user('1 января 1990');
    const r5 = await ctx.user('Подтверждаю');

    try { expectBookingSuccess(r5.history); } catch (e: any) { ctx.fail(`booking: ${e.message}`); }
  },
);

// ── H1. Долгий диалог с многократными уточнениями ──────────────────────────

test(
  'H1 — пациент-итератор, 7+ ходов',
  'Пациент уточняет параметры пошагово: «к кому?» → «терапевт» → «когда?» → «на след неделе» → «среда?» → «11:00» → доходит до записи.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Хочу записаться');
    await ctx.user('К терапевту');
    await ctx.user('На следующей неделе');
    await ctx.user('Среда подойдёт');
    await ctx.user('В 11:00');
    await ctx.user(TEST_PATIENT_LINE);
    const rFinal = await ctx.user('Подтверждаю');

    try { expectBookingSuccess(rFinal.history); } catch (e: any) { ctx.fail(`booking: ${e.message}`); }
    // HARD: финальный slot — Ср следующей недели (пациент сказал «следующая неделя»), 11:00.
    const wed = nextWeekDay(3);
    const last = rFinal.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (last?.function_call) {
      try {
        const args = JSON.parse(last.function_call.arguments);
        if (!String(args.startTime ?? '').startsWith(toIso(wed))) ctx.fail(`startTime="${args.startTime}", ожидали ${toIso(wed)}*`);
        if (!String(args.startTime ?? '').includes('11:00')) ctx.fail(`startTime="${args.startTime}", ожидали 11:00`);
      } catch { /* ignore */ }
    }
  },
);

// ── J1. Запись в прошлое ────────────────────────────────────────────────────

test(
  'J1 — запись в прошлое',
  'Пациент: «Запиши на прошлый понедельник». Бот должен отказать.',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('Запиши меня к терапевту на прошлый понедельник');

    const hasSuccess = r.history.some(m => {
      if (m.role !== 'function' || m.name !== 'book_appointment') return false;
      try { return JSON.parse(m.content).success === true; } catch { return false; }
    });
    if (hasSuccess) ctx.fail('book_appointment.success=true при запросе на прошлую дату');

    // Soft: бот должен явно отказать или предложить другую дату.
    const lower = r.reply.toLowerCase();
    if (!/прошл|нельзя|невозможн|нет.*дат|будущ|выберите/i.test(lower)) {
      ctx.flag(`Бот не явно отказал от записи в прошлое: ${r.reply.slice(0, 200)}`);
    }
  },
);

// ── J3. Запрос не по теме клиники ──────────────────────────────────────────

test(
  'J3 — запрос не по теме (погода)',
  'Пациент: «Какая погода завтра?». Бот должен сказать, что отвечает только на вопросы клиники.',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('Какая погода завтра?');

    // Не должно быть никаких медицинских tool-вызовов.
    const medicalToolCalls = r.history.filter(m =>
      m.role === 'assistant' && m.function_call &&
      ['find_doctors_and_slots', 'book_appointment', 'find_services'].includes(m.function_call.name)
    );
    if (medicalToolCalls.length > 0) ctx.flag(`Бот вызвал медицинские tools на off-topic запрос: ${medicalToolCalls.map(m => m.function_call!.name).join(', ')}`);

    // Soft: бот объясняет, что не отвечает на off-topic.
    const lower = r.reply.toLowerCase();
    if (!/клиник|только\s+(на|о)|медицин|записать?|приём/i.test(lower)) {
      ctx.flag(`Бот не объяснил, что отвечает только на вопросы клиники: ${r.reply.slice(0, 200)}`);
    }
  },
);

// ── K1. Запись → проверка → отмена ─────────────────────────────────────────

test(
  'K1 — запись, потом отмена в той же сессии',
  'Создаём запись, потом «когда у меня запись?», потом «отмени».',
  async (ctx: TestContext) => {
    resetMock();
    // setup
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первое');
    await ctx.user(TEST_PATIENT_LINE);
    await ctx.user('Подтверждаю');

    // проверка
    const r5 = await ctx.user('А когда у меня запись?');
    const wed = nearestWeekday(3);
    if (!r5.reply.includes('27 мая') && !r5.reply.toLowerCase().includes('сред') && !r5.reply.includes(toIso(wed))) {
      ctx.flag(`Бот не назвал дату при «когда у меня запись?»: ${r5.reply.slice(0, 200)}`);
    }

    // отмена
    await ctx.user('Отмени её');
    await ctx.user('Да, подтверждаю');

    const active = activeMockAppointments();
    if (active.length > 0) ctx.fail(`После отмены активных=${active.length}, ожидали 0`);
  },
);

// ── Расширенный набор (приоритет 2) ────────────────────────────────────────

// ── A6. Смена специализации (терапевт → косметолог) ────────────────────────

test(
  'A6 — смена специализации (терапевт → косметолог)',
  'Пациент: «к терапевту», потом «к косметологу». Бот переключается.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Запиши меня к терапевту');
    await ctx.user('А вообще передумал, запишите к косметологу');
    await ctx.user('Возьму первый предложенный вариант');
    await ctx.user(TEST_PATIENT_LINE);
    const r5 = await ctx.user('Подтверждаю');
    try { expectBookingSuccess(r5.history); } catch (e: any) { ctx.fail(`booking: ${e.message}`); }

    const last = r5.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (last?.function_call) {
      try {
        const args = JSON.parse(last.function_call.arguments);
        if (args.specialityId !== 9) ctx.fail(`specialityId=${args.specialityId}, ожидали 9 (Косметолог), не 1 (Терапевт)`);
      } catch { /* ignore */ }
    }
  },
);

// ── A7. Запрос подешевле ────────────────────────────────────────────────────

test(
  'A7 — запрос «А есть подешевле?»',
  'Пациент: «ботокс», бот предлагает 11500₽. Пациент: «А подешевле?». Soft check на корректный ответ.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Хочу записаться на ботокс');
    const r2 = await ctx.user('А есть подешевле?');
    // Soft: бот должен либо назвать альтернативы, либо объяснить.
    const lower = r2.reply.toLowerCase();
    if (!/подешевл|дешев|альтернатив|цен|стоимост|другую процедуру|увы|нет|единая/i.test(lower)) {
      ctx.flag(`Бот не ответил содержательно про цену: ${r2.reply.slice(0, 200)}`);
    }
  },
);

// ── B3. Стоп до выбора слота ────────────────────────────────────────────────

test(
  'B3 — стоп после первого ответа бота',
  'Запиши → бот предлагает слоты → пациент: «ладно, потом сам напишу». Никаких записей.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Запиши меня к терапевту');
    await ctx.user('Ладно, потом сам напишу');

    const active = activeMockAppointments();
    if (active.length > 0) ctx.fail(`Создано записей=${active.length}, ожидали 0`);
  },
);

// ── C3. Перенос со сменой врача ─────────────────────────────────────────────

test(
  'C3 — перенос со сменой врача',
  'Запись к Ивановой в среду, потом «А давай к Петрову вместо». Новая запись к Петрову.',
  async (ctx: TestContext) => {
    resetMock();
    // setup: к Ивановой в среду
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('К Ивановой возьму первое время');
    await ctx.user(TEST_PATIENT_LINE);
    await ctx.user('Подтверждаю');

    // перенос к Петрову (он работает Вт/Чт/Сб)
    await ctx.user('А давай вместо Ивановой запиши к Петрову в субботу');
    await ctx.user('Возьму первое время');
    await ctx.user('Подтверждаю');

    const active = activeMockAppointments();
    const petrov = active.filter(a => a.doctor_id === 1004);
    const ivanova = active.filter(a => a.doctor_id === 1001);
    if (petrov.length === 0) ctx.fail(`Активной записи к Петрову нет (всего активных: ${active.length})`);
    if (ivanova.length > 0) ctx.fail(`Запись к Ивановой осталась — должна быть отменена при переносе`);
  },
);

// ── C5. Отказ от переноса в процессе ───────────────────────────────────────

test(
  'C5 — отказ от переноса в процессе',
  'Запись есть, пациент просит перенести, бот спрашивает время, пациент: «А, передумал». Запись не должна быть тронута.',
  async (ctx: TestContext) => {
    resetMock();
    // setup
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первое');
    await ctx.user(TEST_PATIENT_LINE);
    await ctx.user('Подтверждаю');

    const before = activeMockAppointments();
    const beforeUuids = before.map(a => a.uuid).sort();

    await ctx.user('Перенеси на другой день');
    await ctx.user('А, ладно, оставлю как есть');

    const after = activeMockAppointments();
    const afterUuids = after.map(a => a.uuid).sort();
    if (JSON.stringify(beforeUuids) !== JSON.stringify(afterUuids)) {
      ctx.fail(`UUID активных записей изменились: было ${beforeUuids.join(',')}, стало ${afterUuids.join(',')}`);
    }
  },
);

// ── E2. Конфликт → «другое время» ──────────────────────────────────────────

test(
  'E2 — конфликт → выбрать другое время',
  'Запись в среду на 09:00, попытка записать снова на тот же слот → бот говорит про конфликт → пациент: «выбрать другое время».',
  async (ctx: TestContext) => {
    resetMock();
    // setup
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму в 09:00');
    await ctx.user(TEST_PATIENT_LINE);
    await ctx.user('Подтверждаю');

    // попытка дубля — мок предфильтрует, поэтому LLM скорее всего предложит ближайший доступный
    await ctx.user('Запиши снова к терапевту в среду в 09:00');
    await ctx.user('Выбрать другое время');
    await ctx.user('В 14:00');
    await ctx.user(TEST_PATIENT_LINE);
    await ctx.user('Подтверждаю');

    // Ожидаем 2 активные записи (старая 09:00 + новая 14:00).
    const active = activeMockAppointments();
    if (active.length < 2) ctx.flag(`Активных=${active.length}, ожидали ≥2 (старая 09:00 + новая 14:00)`);
  },
);

// ── F4. Отказ давать данные ─────────────────────────────────────────────────

test(
  'F4 — отказ давать персональные данные',
  'Бот в гостевом режиме просит данные, пациент: «Не хочу давать». Бот объясняет необходимость.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первое');
    const r3 = await ctx.user('Не хочу давать персональные данные');

    // HARD: записи быть не должно.
    if (activeMockAppointments().length > 0) ctx.fail('Активная запись есть, ожидали 0');

    // Soft: бот должен объяснить.
    const lower = r3.reply.toLowerCase();
    if (!/нужн|обязательн|без.*невозможн|для\s+запис|треб|необходим/i.test(lower)) {
      ctx.flag(`Бот не объяснил необходимость данных: ${r3.reply.slice(0, 200)}`);
    }
  },
);

// ── G2. Услуга на конкретный день ──────────────────────────────────────────

test(
  'G2 — услуга «чистка лица» в субботу',
  'Беляева работает Сб и делает чистку. Бот находит и предлагает.',
  async (ctx: TestContext) => {
    resetMock();
    const sat = nearestWeekday(6);
    await ctx.user('Запиши на чистку лица в субботу');
    await ctx.user('Возьму первое время');
    await ctx.user(TEST_PATIENT_LINE);
    const r4 = await ctx.user('Подтверждаю');
    try { expectBookingSuccess(r4.history); } catch (e: any) { ctx.fail(`booking: ${e.message}`); }

    const last = r4.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (last?.function_call) {
      try {
        const args = JSON.parse(last.function_call.arguments);
        if (args.specialityId !== 9) ctx.fail(`specialityId=${args.specialityId}, ожидали 9 (Косметолог)`);
        if (args.price !== 3400) ctx.flag(`price=${args.price}, ожидали 3400 (Чистка лица)`);
        if (!String(args.startTime ?? '').startsWith(toIso(sat))) ctx.fail(`startTime="${args.startTime}", ожидали ${toIso(sat)}*`);
      } catch { /* ignore */ }
    }
  },
);

// ── G3. Услуга → переключение «к косметологу вообще» ───────────────────────

test(
  'G3 — услуга → «к косметологу вообще»',
  'Запрос «плазмолифтинг», потом передумал → «к косметологу на приём». Цена должна стать 2500 (приём), не 7800 (плазмолифтинг).',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Хочу записаться на плазмолифтинг');
    await ctx.user('А, не знаю, просто запишите на приём к косметологу');
    await ctx.user('Возьму первый вариант');
    await ctx.user(TEST_PATIENT_LINE);
    const r5 = await ctx.user('Подтверждаю');
    try { expectBookingSuccess(r5.history); } catch (e: any) { ctx.fail(`booking: ${e.message}`); }

    const last = r5.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (last?.function_call) {
      try {
        const args = JSON.parse(last.function_call.arguments);
        if (args.price === 7800) ctx.fail(`price=7800 (Плазмолифтинг), ожидали ≠7800 (должен быть приём, не процедура)`);
        if (args.specialityId !== 9) ctx.fail(`specialityId=${args.specialityId}, ожидали 9 (Косметолог)`);
      } catch { /* ignore */ }
    }
  },
);

// ── H2. Капризный пациент, много смен параметров ──────────────────────────

test(
  'H2 — капризный пациент: много смен дня и времени',
  'Запись → передумал → другой день → ещё передумал → ещё другой день → выбрал → подтвердил.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Запиши меня к терапевту');
    await ctx.user('Нет, на пятницу');
    await ctx.user('Нет, лучше во вторник');
    await ctx.user('А во сколько начинаются приёмы?');
    await ctx.user('Хорошо, в 10:30 беру');
    await ctx.user(TEST_PATIENT_LINE);
    const rFinal = await ctx.user('Подтверждаю');

    try { expectBookingSuccess(rFinal.history); } catch (e: any) { ctx.fail(`booking: ${e.message}`); }

    // HARD: финальный slot во вторник, 10:30.
    const tue = nearestWeekday(2);
    const last = rFinal.history.filter(m => m.role === 'assistant' && m.function_call?.name === 'book_appointment').pop();
    if (last?.function_call) {
      try {
        const args = JSON.parse(last.function_call.arguments);
        if (!String(args.startTime ?? '').startsWith(toIso(tue))) ctx.fail(`startTime="${args.startTime}", ожидали ${toIso(tue)}*`);
        if (!String(args.startTime ?? '').includes('10:30')) ctx.flag(`startTime="${args.startTime}", ожидали 10:30`);
      } catch { /* ignore */ }
    }
  },
);

// ── I1. Разговорный стиль ──────────────────────────────────────────────────

test(
  'I1 — разговорный стиль',
  '«А когда у вас терапевт-то принимает?» — бот даёт расписание / ближайшие слоты.',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('А когда у вас терапевт-то принимает?');
    // Soft: бот должен показать слоты или расписание.
    const lower = r.reply.toLowerCase();
    if (!/принима|приём|свободн|слот|записать|время|часах|дн[еия]/i.test(lower)) {
      ctx.flag(`Бот не дал полезного ответа на разговорный запрос: ${r.reply.slice(0, 200)}`);
    }
  },
);

// ── I2. Опечатки ───────────────────────────────────────────────────────────

test(
  'I2 — опечатка «терепвт»',
  'Пациент: «терепвт» (опечатка). Бот должен распознать (fuzzy) или уточнить.',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('Запиши меня к терепвту в среду');
    // Soft: бот должен показать варианты терапевта ИЛИ переспросить.
    const lower = r.reply.toLowerCase();
    if (!/терапевт|уточн|непонят|какой|нашли|свободн/i.test(lower)) {
      ctx.flag(`Бот не понял опечатку и не переспросил: ${r.reply.slice(0, 200)}`);
    }
  },
);

// ── I3. Очень короткие фразы ───────────────────────────────────────────────

test(
  'I3 — пошаговый ввод очень короткими фразами',
  '«к терапевту» → «среда» → «11» → «да». Бот должен довести до записи.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('к терапевту');
    await ctx.user('среда');
    await ctx.user('11');
    await ctx.user(TEST_PATIENT_LINE);
    const r5 = await ctx.user('да');

    // Soft: бот должен завершить запись.
    if (!hasSuccessfulBooking(r5.history)) {
      ctx.flag(`Не дошли до успешной записи через короткие фразы. Финал: ${r5.reply.slice(0, 200)}`);
    }
  },
);

// ── J2. Несуществующая специальность ───────────────────────────────────────

test(
  'J2 — несуществующая специальность',
  '«Запиши к нейрохирургу-офтальмологу». Бот должен сказать, что такой специализации нет / предложить альтернативы.',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('Запиши меня к нейрохирургу-офтальмологу');

    // HARD: не должно быть успешного book_appointment.
    if (hasSuccessfulBooking(r.history)) ctx.fail('book_appointment.success=true для несуществующей специальности');

    // Soft: бот объясняет/предлагает.
    const lower = r.reply.toLowerCase();
    if (!/нет.*такой|нет.*специ|не.*найден|нет.*врач|альтернатив|другую|есть.*следующ|доступн|укажите/i.test(lower)) {
      ctx.flag(`Бот не объяснил отсутствие специализации: ${r.reply.slice(0, 200)}`);
    }
  },
);

// ── J4. Несуществующая услуга ──────────────────────────────────────────────

test(
  'J4 — несуществующая услуга',
  '«Запиши на ринопластику». Бот должен сказать, что такой услуги нет / предложить альтернативы.',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('Запиши меня на ринопластику');

    // HARD: не должно быть успешного book_appointment.
    if (hasSuccessfulBooking(r.history)) ctx.fail('book_appointment.success=true для несуществующей услуги');

    // Soft: бот объясняет/предлагает.
    const lower = r.reply.toLowerCase();
    if (!/нет.*такой|нет.*услуг|не.*найден|не предлагаем|не оказ|альтернатив|другую|доступн|укажите/i.test(lower)) {
      ctx.flag(`Бот не объяснил отсутствие услуги: ${r.reply.slice(0, 200)}`);
    }
  },
);

// ── K2. Запись → перенос → отмена ──────────────────────────────────────────

test(
  'K2 — полный жизненный цикл записи',
  'Создать запись → перенести → отменить. В моке должны остаться 2 canceled (старая + перенос).',
  async (ctx: TestContext) => {
    resetMock();
    // 1. Setup
    await ctx.user('Запиши меня к терапевту в среду');
    await ctx.user('Возьму первое');
    await ctx.user(TEST_PATIENT_LINE);
    await ctx.user('Подтверждаю');

    // 2. Перенос на пятницу
    await ctx.user('Перенеси на пятницу');
    await ctx.user('Возьму первое');
    await ctx.user('Подтверждаю');

    // 3. Отмена
    await ctx.user('Отмени мою запись');
    await ctx.user('Да, подтверждаю');

    const allBookings = readMockAppointments();
    const active = allBookings.filter(a => !a.canceled);
    const canceled = allBookings.filter(a => a.canceled);

    if (active.length > 0) ctx.fail(`После полного цикла активных=${active.length}, ожидали 0`);
    if (canceled.length < 2) ctx.flag(`Canceled=${canceled.length}, ожидали ≥2 (старая + перенос)`);
  },
);

// ── Запуск ──────────────────────────────────────────────────────────────────

runAll(process.argv[2]).catch((e) => {
  console.error(e);
  process.exit(1);
});
