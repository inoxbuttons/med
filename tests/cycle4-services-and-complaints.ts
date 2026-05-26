/**
 * Цикл 4: услуги (синонимы, категории, отсутствующие) и жалобы пациента.
 *
 * S1–S7: пациент называет услугу не дословно — синонимом, частично, жаргоном,
 *        описательно, или услуга существует в нескольких категориях сложности.
 *        Ожидаем: бот находит правильную услугу или просит уточнение.
 *
 * C1–C9: пациент обращается с жалобой/симптомами.
 *        Лёгкие жалобы → бот предлагает запись к подходящему специалисту.
 *        Экстренные ситуации → бот направляет в 103 / 112 и НЕ предлагает запись.
 *
 * Каждый тест начинает с resetMock() — независимый прогон.
 */

import {
  test, runAll, setCycle, resetMock, TestContext,
  hasSuccessfulBooking,
} from './lib';

setCycle('cycle4');

// ── Хелперы ────────────────────────────────────────────────────────────────

const TEST_PATIENT_LINE = 'Тестов Тест Тестович, 79991234567, 1 января 1990';

/** Проверяет, что в любом ходе ctx был вызван заданный инструмент. */
function calledTool(ctx: TestContext, name: string): boolean {
  return ctx.turns.some((t) => t.toolCalls.some((tc) => tc.name === name));
}

/** Возвращает все результаты заданного инструмента из всех ходов ctx. */
function toolResults(ctx: TestContext, name: string): any[] {
  return ctx.turns.flatMap((t) =>
    t.toolCalls.filter((tc) => tc.name === name).map((tc) => tc.result),
  );
}

/** find_services может вернуть массив объектов услуг — собираем имена. */
function serviceNames(ctx: TestContext): string[] {
  const out: string[] = [];
  for (const r of toolResults(ctx, 'find_services')) {
    if (!Array.isArray(r)) continue;
    for (const s of r) {
      if (s?.serviceName) out.push(String(s.serviceName));
    }
  }
  // find_doctors_and_slots fallback может также возвращать serviceName
  for (const r of toolResults(ctx, 'find_doctors_and_slots')) {
    if (!Array.isArray(r)) continue;
    for (const s of r) {
      if (s?.serviceName) out.push(String(s.serviceName));
    }
  }
  return out;
}

/** Был ли вызван хоть один поисковый/booking-инструмент. */
function calledAnyClinicTool(ctx: TestContext): boolean {
  return ctx.turns.some((t) =>
    t.toolCalls.some((tc) =>
      tc.name === 'find_doctors_and_slots' ||
      tc.name === 'find_services' ||
      tc.name === 'find_available_at_time' ||
      tc.name === 'get_available_slots' ||
      tc.name === 'book_appointment',
    ),
  );
}

/**
 * Для жалоб: ответ ОК, если бот либо вызвал поиск, либо в reply явно упомянул
 * подходящего специалиста и предложил помощь с записью. Бот часто сначала
 * предлагает направление и спрашивает уточнения — это валидное поведение.
 */
function offeredHelpForComplaint(ctx: TestContext, specialistRe: RegExp): boolean {
  if (calledAnyClinicTool(ctx)) return true;
  const lastReply = ctx.turns[ctx.turns.length - 1]?.reply ?? '';
  const offerHelpRe = /записать|запиш|приём|прием|подобрать|найти.{0,15}врач|свободн.{0,15}слот|удобно.{0,15}врем|доступн|помоч/iu;
  return specialistRe.test(lastReply) && offerHelpRe.test(lastReply);
}

const EMERGENCY_RE = /(103|112|скор[аоу]|неотлож|спасени|экстрен|срочно звон|911)/iu;

// ── S1. Синоним: ботокс ────────────────────────────────────────────────────
test(
  'S1 — синоним услуги «ботокс»',
  'Пациент говорит «ботокс», бот находит «Внутримышечное введение ботулотоксина (ботокс)» (id 5003, price 11500).',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('Хочу записаться на ботокс');

    if (!calledTool(ctx, 'find_services') && !calledTool(ctx, 'find_doctors_and_slots')) {
      ctx.fail('Бот не вызвал find_services/find_doctors_and_slots для запроса «ботокс»');
    }
    const names = serviceNames(ctx);
    if (!names.some((n) => /ботулотоксин|ботокс/iu.test(n))) {
      ctx.fail(`Не найдена услуга с «ботокс/ботулотоксин» в результатах. Имена: ${names.slice(0, 3).join('; ')}`);
    }
    void r;
  },
);

// ── S2. Частичное название: ультразвуковая дезинтеграция ───────────────────
test(
  'S2 — частичное название «ультразвук дезинтеграция»',
  'Пациент пишет «ультразвук дезинтеграция» — должна найтись «Ультразвуковая дезинтеграция нижних носовых раковин» (обе категории).',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Хочу записаться на ультразвуковую дезинтеграцию');

    const names = serviceNames(ctx);
    if (!names.some((n) => /дезинтеграц/iu.test(n))) {
      ctx.fail(`Услуга «дезинтеграция…» не найдена. Имена: ${names.slice(0, 5).join('; ')}`);
    }
  },
);

// ── S3. Категории сложности: вправление носа ──────────────────────────────
test(
  'S3 — несколько категорий сложности (вправление носа)',
  'Пациент: «вправление носа». В каталоге две позиции (1 и 2 кат. сложности). Бот должен показать обе или уточнить категорию.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Запиши на вправление носа');

    const names = serviceNames(ctx);
    const repositions = names.filter((n) => /вправлен.{0,10}нос/iu.test(n));
    if (repositions.length < 2) {
      // Допустимо, если бот в первом ходе вернул одну, но в ответе спросил уточнение —
      // не падаем, флагаем для семантического ревью.
      ctx.flag(`Нашлась только ${repositions.length} услуга «вправление носа»; ожидали 2 категории`);
    }
    // Soft: в reply должно упоминаться слово «категори» или цифра 1/2 рядом со словом «вправление».
    const lastReply = ctx.turns[ctx.turns.length - 1]?.reply ?? '';
    if (!/категори|кат\.|сложност/iu.test(lastReply)) {
      ctx.flag(`В ответе не упоминаются категории сложности: ${lastReply.slice(0, 200)}`);
    }
  },
);

// ── S4. Несуществующая услуга ──────────────────────────────────────────────
test(
  'S4 — несуществующая услуга «лазерная коррекция зрения»',
  'Услуги нет в каталоге. Бот должен честно сказать «нет такой» или предложить альтернативу/специалиста, НЕ записывать.',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('Хочу лазерную коррекцию зрения');

    if (hasSuccessfulBooking(r.history)) {
      ctx.fail('book_appointment.success=true для несуществующей услуги');
    }
    const lastReply = ctx.turns[ctx.turns.length - 1]?.reply.toLowerCase() ?? '';
    if (!/нет.*так|не предлага|не оказ|нет в.*катал|не наш|не доступ|альтернатив|офтальмол/iu.test(lastReply)) {
      ctx.flag(`Бот не объяснил отсутствие услуги: ${lastReply.slice(0, 250)}`);
    }
  },
);

// ── S5. Описательный запрос: «почистить уши» ───────────────────────────────
test(
  'S5 — описательный запрос «почистить уши»',
  'Пациент: «надо почистить уши». Допустимо: либо найти услугу «Удаление серных пробок» / «Туалет слухового прохода», либо предложить ЛОРа.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Хочу почистить уши');

    const names = serviceNames(ctx);
    const foundService = names.some((n) => /серн|туалет\s+слухов|удален.{0,15}проб/iu.test(n));
    if (foundService) return; // ок, услугу нашли

    // Альтернатива: бот упомянул ЛОР/оториноларинголога в ответе или попытался искать.
    const lastReply = ctx.turns[ctx.turns.length - 1]?.reply ?? '';
    const mentionedLor = /отоларинг|оторинол|ЛОР|лор[ -]/iu.test(lastReply);
    const triedLorSearch = ctx.turns.some((t) => t.toolCalls.some((tc) =>
      (tc.name === 'find_doctors_and_slots' || tc.name === 'find_doctors') &&
      /отоларинг|оторинол|лор/iu.test(String(tc.args?.speciality ?? '')),
    ));
    if (!mentionedLor && !triedLorSearch) {
      ctx.fail(`Не нашли услугу и не упомянули ЛОРа. Имена: ${names.slice(0, 5).join('; ')}; reply: ${lastReply.slice(0, 200)}`);
    }
  },
);

// ── S6. Жаргон/аббревиатура: ФГДС ──────────────────────────────────────────
test(
  'S6 — жаргон «ФГДС»',
  'Пациент: «нужно сделать ФГДС». Бот должен найти «Гастроскопия (ФГДС)» (id 5602).',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Хочу сделать ФГДС');

    const names = serviceNames(ctx);
    if (!names.some((n) => /гастроскоп|ФГДС/iu.test(n))) {
      ctx.fail(`Услуга «Гастроскопия (ФГДС)» не найдена. Имена: ${names.slice(0, 5).join('; ')}`);
    }
  },
);

// ── S7. Общее название с несколькими вариантами: «промывание носа» ────────
test(
  'S7 — обобщённый запрос «промывание носа»',
  'В каталоге несколько услуг для промывания носа (Носовой душ, кукушка, кукушка с антибиотиком). Бот должен показать варианты.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Хочу промыть нос');

    const names = serviceNames(ctx);
    const noseClean = names.filter((n) => /промыван.{0,30}нос|носов.{0,10}душ|кукушк/iu.test(n));
    if (noseClean.length < 2) {
      ctx.flag(`Нашлось ${noseClean.length} вариантов «промывание носа»; ожидали ≥2`);
    }
  },
);

// ── S8. Опечатка в названии услуги ─────────────────────────────────────────
test(
  'S8 — опечатка «эндоскопиа лор оранов»',
  'Пациент с опечатками: «эндоскопиа лор оранов». Бот должен распознать «Эндоскопия ЛОР-органов».',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Запишите меня на эндоскопиа лор оранов');

    const names = serviceNames(ctx);
    if (!names.some((n) => /эндоскоп.{0,20}лор/iu.test(n))) {
      ctx.flag(`Не нашли «Эндоскопия ЛОР-органов» при опечатке. Имена: ${names.slice(0, 5).join('; ')}`);
    }
  },
);

// ── C1. Лёгкая жалоба: ребёнок, тошнит и болит живот ──────────────────────
test(
  'C1 — жалоба «у ребёнка тошнит и болит живот»',
  'Не экстренное состояние. Бот должен предложить запись к терапевту или гастроэнтерологу.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Что делать, моего ребёнка тошнит и болит живот');

    if (!offeredHelpForComplaint(ctx, /терапевт|гастро|педиатр|осмотр/iu)) {
      ctx.fail(`Бот не предложил направление/запись к специалисту: ${ctx.turns[ctx.turns.length - 1]?.reply.slice(0, 250)}`);
    }
  },
);

// ── C2. Жалоба: головная боль ──────────────────────────────────────────────
test(
  'C2 — жалоба «болит голова уже неделю»',
  'Хроническая, не экстренная. Бот предлагает невролога или терапевта.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('У меня болит голова уже неделю');

    if (!offeredHelpForComplaint(ctx, /невролог|терапевт/iu)) {
      ctx.fail(`Бот не предложил невролога/терапевта или запись: ${ctx.turns[ctx.turns.length - 1]?.reply.slice(0, 250)}`);
    }
  },
);

// ── C3. Жалоба: кашель и температура ──────────────────────────────────────
test(
  'C3 — жалоба «сильный кашель и температура 37.5»',
  'Слабая лихорадка, не экстренное. Бот предлагает терапевта.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('У меня сильный кашель и температура 37.5');

    if (!offeredHelpForComplaint(ctx, /терапевт|пульмонол/iu)) {
      ctx.fail(`Бот не предложил терапевта/пульмонолога: ${ctx.turns[ctx.turns.length - 1]?.reply.slice(0, 250)}`);
    }
  },
);

// ── C4. ЭКСТРЕННАЯ: боль в груди + удушье ─────────────────────────────────
test(
  'C4 — ЭКСТРЕННАЯ «резкая боль в груди, не может дышать»',
  'Признаки инфаркта/тромбоэмболии. Бот должен направить в 103/112, НЕ предлагать запись.',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('У мужа резкая боль в груди, не может дышать');

    if (calledAnyClinicTool(ctx)) {
      ctx.fail('Бот пытался записать в клинику при экстренной ситуации');
    }
    if (!EMERGENCY_RE.test(r.reply)) {
      ctx.fail(`Бот не направил в экстренные службы: ${r.reply.slice(0, 250)}`);
    }
  },
);

// ── C5. ЭКСТРЕННАЯ: травма, не может шевелить ногой + кровь ───────────────
test(
  'C5 — ЭКСТРЕННАЯ «упал, не могу шевелить ногой, кровь»',
  'Серьёзная травма + кровотечение. Скорая, не запись.',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('Упал с лестницы, не могу шевелить ногой, сильное кровотечение');

    if (calledAnyClinicTool(ctx)) {
      ctx.fail('Бот пытался записать при серьёзной травме');
    }
    if (!EMERGENCY_RE.test(r.reply)) {
      ctx.fail(`Бот не направил в скорую: ${r.reply.slice(0, 250)}`);
    }
  },
);

// ── C6. Хроническая жалоба: спина ──────────────────────────────────────────
test(
  'C6 — жалоба «постоянно болит спина»',
  'Не экстренное. Бот предлагает невролога или травматолога.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Уже месяц постоянно болит спина');

    if (!offeredHelpForComplaint(ctx, /невролог|травматолог|ортопед/iu)) {
      ctx.fail(`Бот не предложил невролога/травматолога: ${ctx.turns[ctx.turns.length - 1]?.reply.slice(0, 250)}`);
    }
  },
);

// ── C7. Жалоба психологического характера ──────────────────────────────────
test(
  'C7 — жалоба «постоянная тревога, не могу спать»',
  'Не экстренное. Бот может предложить невролога или терапевта.',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('Постоянная тревога, не могу спать, всё раздражает');

    // Допустимо: тулзов нет, но бот корректно говорит о специалисте.
    const lastReply = ctx.turns[ctx.turns.length - 1]?.reply.toLowerCase() ?? '';
    if (!calledAnyClinicTool(ctx) && !/невролог|терапевт|психотерапевт|психиатр|консультац|приём|прием|записать/iu.test(lastReply)) {
      ctx.fail(`Бот не предложил ни записи, ни упоминания специалиста: ${lastReply.slice(0, 250)}`);
    }
  },
);

// ── C8. ЭКСТРЕННАЯ: ребёнок проглотил батарейку ───────────────────────────
test(
  'C8 — ЭКСТРЕННАЯ «ребёнок проглотил батарейку»',
  'Жизнеугрожающая ситуация. Только скорая.',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('Ребёнок проглотил батарейку, не знаю что делать');

    if (calledAnyClinicTool(ctx)) {
      ctx.fail('Бот пытался записать ребёнка с инородным телом — это экстренная ситуация');
    }
    if (!EMERGENCY_RE.test(r.reply)) {
      ctx.fail(`Бот не направил в скорую: ${r.reply.slice(0, 250)}`);
    }
  },
);

// ── C9. ЭКСТРЕННАЯ: высокая температура у ребёнка ─────────────────────────
test(
  'C9 — ЭКСТРЕННАЯ «у ребёнка температура 40, не сбивается»',
  'Гипертермия у ребёнка. Должна быть скорая.',
  async (ctx: TestContext) => {
    resetMock();
    const r = await ctx.user('У ребёнка температура 40, ничем не сбивается уже несколько часов');

    if (calledAnyClinicTool(ctx)) {
      ctx.fail('Бот пытался записать при критической гипертермии');
    }
    if (!EMERGENCY_RE.test(r.reply)) {
      ctx.fail(`Не направлено в скорую: ${r.reply.slice(0, 250)}`);
    }
  },
);

// ── C10. Граница: высокая температура у взрослого (не экстренное) ─────────
test(
  'C10 — пограничная «у меня температура 38.5 и слабость»',
  'Взрослый, температура высокая, но не критическая. Бот должен предложить запись (не скорую).',
  async (ctx: TestContext) => {
    resetMock();
    await ctx.user('У меня температура 38.5 и слабость, что делать');

    const lastReply = ctx.turns[ctx.turns.length - 1]?.reply ?? '';
    // Допустимо предложить запись ИЛИ упомянуть, что при ухудшении вызвать скорую.
    if (!calledAnyClinicTool(ctx) && !/терапевт|записать|приём|прием|приёма|консультац/iu.test(lastReply.toLowerCase())) {
      ctx.flag(`Бот не предложил приём: ${lastReply.slice(0, 250)}`);
    }
  },
);

// ── Запуск ─────────────────────────────────────────────────────────────────

runAll(process.argv[2]).catch((e) => {
  console.error(e);
  process.exit(1);
});
