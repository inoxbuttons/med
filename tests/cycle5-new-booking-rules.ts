/**
 * Цикл 5: Новые правила записи (21vek branch)
 *
 * R1 — Цена приёма: бот вызывает get_doctor_consultation_services и показывает
 *      первичный/повторный с ценой.
 * R2 — Запись к врачу: после выбора слота бот спрашивает тип приёма (первичный/повторный)
 *      и включает цену в сводку.
 * R3 — self_booking:false + нет направления: бот предлагает записаться к врачу-специалисту.
 * R4 — self_booking:false + at_doctor_visit:true + есть направление:
 *      бот объясняет, что процедура выполняется на приёме врача.
 * R5 — self_booking:false + at_doctor_visit:false + есть направление + гость:
 *      бот собирает данные и вызывает create_operator_request.
 * R6 — Полный flow записи с уточнением типа приёма.
 *
 * Тесты работают против локального dev-сервера (PORT=3002),
 * не передают misType → routing на localDbService.
 */

import { test, runAll, setCycle, TestContext } from './lib';

setCycle('cycle5');

// ── HTTP helper (без misType → local DB) ─────────────────────────────────────

const API_URL = process.env.CHAT_API ?? 'http://localhost:3002/chat/message';

interface Msg { role: string; content: string; name?: string; function_call?: { name: string; arguments: string }; }
interface ChatResp { sessionId: string; reply: string; history: Msg[]; }

async function send(sessionId: string, message: string): Promise<ChatResp> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, clinicNetId: 1 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<ChatResp>;
}

/** Отправляет сообщение, пишет ход в ctx.turns (работает с ctx от test-runner). */
async function u(ctx: TestContext, message: string): Promise<ChatResp> {
  const t0 = Date.now();
  const r = await send(ctx.sessionId, message);

  let startIdx = -1;
  for (let i = r.history.length - 1; i >= 0; i--) {
    if (r.history[i].role === 'user' && r.history[i].content === message) { startIdx = i; break; }
  }
  const slice = startIdx >= 0 ? r.history.slice(startIdx) : r.history;

  const toolCalls: any[] = [];
  for (let i = 0; i < slice.length; i++) {
    const m = slice[i];
    if (m.role === 'assistant' && m.function_call) {
      let args: any = {};
      try { args = JSON.parse(m.function_call.arguments); } catch { /* */ }
      let result: any = null;
      const nxt = slice[i + 1];
      if (nxt?.role === 'function' && nxt.name === m.function_call.name) {
        try { result = JSON.parse(nxt.content); } catch { result = nxt.content; }
      }
      toolCalls.push({ name: m.function_call.name, args, result });
    }
  }
  (ctx as any).turns.push({ user: message, reply: r.reply, toolCalls, slice, tookMs: Date.now() - t0 });
  (ctx as any).lastHistory = r.history;
  return r;
}

function calledTool(ctx: TestContext, name: string): boolean {
  return ctx.turns.some((t) => t.toolCalls.some((tc: any) => tc.name === name));
}

function toolResults(ctx: TestContext, name: string): any[] {
  return ctx.turns.flatMap((t) => t.toolCalls.filter((tc: any) => tc.name === name).map((tc: any) => tc.result));
}

function allReplies(ctx: TestContext): string {
  return ctx.turns.map((t) => t.reply).join('\n');
}

function lastReply(ctx: TestContext): string {
  return ctx.turns[ctx.turns.length - 1]?.reply ?? '';
}

// ── R1: Цена приёма ──────────────────────────────────────────────────────────

test(
  'R1 — price inquiry calls get_doctor_consultation_services',
  'Пациент спрашивает цену приёма терапевта → бот вызывает get_doctor_consultation_services',
  async (ctx: TestContext) => {
    const r = await u(ctx, 'сколько стоит прием терапевта?');

    if (!calledTool(ctx, 'get_doctor_consultation_services')) {
      ctx.fail('Не вызван get_doctor_consultation_services — цена взята из find_doctors без разбивки');
    }

    const svcList = toolResults(ctx, 'get_doctor_consultation_services').flat();
    if (!Array.isArray(svcList) || svcList.length === 0) {
      ctx.fail('get_doctor_consultation_services вернул пустой результат');
    }

    if (!/\d+\s*[₽р]|рубл/i.test(r.reply)) {
      ctx.fail(`Ответ не содержит цену: ${r.reply.slice(0, 200)}`);
    }

    if (!/первич|повтор/i.test(r.reply)) {
      ctx.flag('Ответ не различает первичный/повторный приём');
    }
  },
);

// ── R2: Запись к врачу — вопрос о типе приёма ───────────────────────────────

test(
  'R2 — booking asks primary/repeat after slot selection',
  'После выбора слота к терапевту бот спрашивает тип приёма (первичный/повторный)',
  async (ctx: TestContext) => {
    await u(ctx, 'запишите меня к терапевту на ближайшее время');

    if (!calledTool(ctx, 'find_doctors_and_slots') && !calledTool(ctx, 'find_doctors')) {
      ctx.fail('find_doctors_and_slots / find_doctors не вызваны на первом шаге');
    }

    await u(ctx, 'Возьму первый предложенный');

    // После выбора слота: должен вызвать get_doctor_consultation_services
    if (!calledTool(ctx, 'get_doctor_consultation_services')) {
      ctx.flag('get_doctor_consultation_services не вызван после выбора слота');
    }

    // Бот должен спросить о типе приёма или о данных пациента
    const combined = allReplies(ctx).toLowerCase();
    if (!/первич|повтор|тип приём|фио|телефон|данные|день.{0,10}рожден/i.test(combined)) {
      ctx.flag(`После выбора слота ожидали вопрос о типе приёма или данных. Reply: ${lastReply(ctx).slice(0, 250)}`);
    }
  },
);

// ── R3: self_booking:false + нет направления ─────────────────────────────────

test(
  'R3 — self_booking:false + no referral → suggest doctor visit',
  'Биопсия, нет направления → бот предлагает записаться к врачу-специалисту',
  async (ctx: TestContext) => {
    await u(ctx, 'хочу записаться на биопсию');

    if (!calledTool(ctx, 'find_services')) {
      ctx.fail('find_services не вызван');
    }

    // Проверяем self_booking=false в результатах
    const svcList = toolResults(ctx, 'find_services').flat();
    if (!svcList.some((s: any) => s?.selfBooking === false)) {
      ctx.flag('Среди найденных услуг нет self_booking=false');
    }

    // Бот должен спросить о направлении
    if (!/направлени|назначени/i.test(allReplies(ctx))) {
      ctx.flag('Вопрос о направлении врача не задан');
    }

    // Отвечаем: нет направления
    await u(ctx, 'нет, направления нет');

    const combined = allReplies(ctx).toLowerCase();

    // Должен предложить запись к специалисту
    if (!/записать.{0,30}врач|приём.{0,30}специал|специалист|терапевт|хирург|уролог|гастро|проктолог/i.test(combined)) {
      ctx.flag(`Ожидали предложение записаться к специалисту. Last reply: ${lastReply(ctx).slice(0, 300)}`);
    }

    // НЕ должен создавать заявку оператору
    if (calledTool(ctx, 'create_operator_request')) {
      ctx.fail('create_operator_request не должен вызываться при отсутствии направления');
    }
  },
);

// ── R4: self_booking:false + at_doctor_visit:true + есть направление ─────────

test(
  'R4 — self_booking:false + at_doctor_visit:true + has referral → procedure at visit',
  'ЭКГ (at_doctor_visit=true), есть направление → бот объясняет или перенаправляет к врачу',
  async (ctx: TestContext) => {
    await u(ctx, 'запишите меня на ЭКГ');

    if (!calledTool(ctx, 'find_services')) {
      ctx.fail('find_services не вызван');
    }

    const combined1 = allReplies(ctx).toLowerCase();

    // Если спросил о направлении — подтверждаем
    if (/направлени|назначени/i.test(combined1)) {
      await u(ctx, 'да, у меня есть направление');
    }

    const combined = allReplies(ctx).toLowerCase();

    // Ожидаем: либо объяснение что процедура на приёме, либо перенаправление к врачу
    // НЕ ожидаем create_operator_request (это at_doctor_visit=true)
    if (calledTool(ctx, 'create_operator_request')) {
      ctx.fail('create_operator_request не должен вызываться для at_doctor_visit=true (процедура на приёме)');
    }

    const correctResponse =
      /приём.{0,20}врач|специалист|записаться.{0,20}врач|записать.{0,20}к врач|осуществляется.{0,30}прием|выполняется.{0,30}прием/i.test(combined) ||
      /врач.{0,30}направит|во время.{0,30}консульт|во время.{0,30}прием/i.test(combined);

    if (!correctResponse) {
      ctx.flag(`Ожидали объяснение про приём врача или перенаправление. Combined: ${combined.slice(0, 400)}`);
    }
  },
);

// ── R5: self_booking:false + at_doctor_visit:false + есть направление + гость ─

test(
  'R5 — self_booking:false + at_doctor_visit:false + has referral + guest → operator request',
  'Гастроскопия с направлением, гость → бот собирает данные и вызывает create_operator_request',
  async (ctx: TestContext) => {
    await u(ctx, 'хочу записаться на гастроскопию, у меня есть направление от врача');

    if (!calledTool(ctx, 'find_services')) {
      ctx.fail('find_services не вызван');
    }

    const svcList = toolResults(ctx, 'find_services').flat();
    if (!svcList.some((s: any) => s?.selfBooking === false)) {
      ctx.flag('Гастроскопия не найдена с selfBooking=false');
    }

    // Если спросил о направлении — подтверждаем
    if (/направлени|назначени/i.test(allReplies(ctx))) {
      await u(ctx, 'да, направление есть');
    }

    // Если запрашивает данные пациента — предоставляем
    if (/фио|телефон|данные|имя|день.{0,10}рожден/i.test(allReplies(ctx))) {
      await u(ctx, 'Гастров Иван Петрович, 79991112233, 15 июня 1985');
    } else if (!calledTool(ctx, 'create_operator_request')) {
      // Данные не запрошены и заявка не создана — возможно нужен ещё ход
      await u(ctx, 'ФИО: Гастров Иван Петрович, телефон: 79991112233, дата рождения: 15.06.1985');
    }

    // create_operator_request должен быть вызван
    if (!calledTool(ctx, 'create_operator_request')) {
      ctx.fail('create_operator_request не вызван — заявка оператору не создана');
    } else {
      const opResult = toolResults(ctx, 'create_operator_request')[0];
      if (!opResult?.id) {
        ctx.flag(`create_operator_request не вернул id. Result: ${JSON.stringify(opResult)}`);
      }
      ctx.note(`Заявка создана, id=${opResult?.id}`);
    }

    // Финальный ответ — про администратора
    if (!/администратор|свяжет|заявк/i.test(allReplies(ctx))) {
      ctx.flag('В ответе нет упоминания об администраторе / принятой заявке');
    }
  },
);

// ── R6: полный flow — запись с уточнением типа приёма ────────────────────────

test(
  'R6 — full booking flow with visit-type clarification',
  'Полный flow: выбор слота → первичный → данные пациента → подтверждение → запись',
  async (ctx: TestContext) => {
    // Шаг 1: поиск слотов
    await u(ctx, 'хочу записаться к терапевту на ближайшее время');
    if (!calledTool(ctx, 'find_doctors_and_slots') && !calledTool(ctx, 'find_doctors')) {
      ctx.fail('Поиск врачей/слотов не выполнен');
    }

    // Шаг 2: выбор слота
    await u(ctx, 'запишите меня к первому доступному врачу на первое свободное время');

    // Шаг 3: тип приёма (если спросил)
    if (/первич|повтор|тип приём/i.test(allReplies(ctx))) {
      await u(ctx, 'Первичный');
    }

    // Шаг 4: данные пациента
    if (/фио|телефон|день.{0,10}рожден|данные/i.test(lastReply(ctx))) {
      await u(ctx, 'Терапевтов Алексей Иванович, 79009876543, 10 марта 1990');
    }

    // Если ещё раз просит данные
    if (/фио|телефон|день.{0,10}рожден/i.test(lastReply(ctx))) {
      await u(ctx, 'Терапевтов Алексей Иванович, 79009876543, 10 марта 1990');
    }

    // Шаг 5: подтверждение
    if (/подтвержд|уточни|верно/i.test(lastReply(ctx))) {
      await u(ctx, 'Подтверждаю');
    }

    // Финал
    const booked = ctx.turns.some((t) =>
      t.toolCalls.some((tc: any) => tc.name === 'book_appointment' && tc.result?.success === true),
    );
    if (!calledTool(ctx, 'book_appointment')) {
      ctx.flag('book_appointment не вызван — flow не завершён за отведённые шаги');
    } else if (!booked) {
      const bookRes = ctx.turns
        .flatMap((t) => t.toolCalls.filter((tc: any) => tc.name === 'book_appointment'))
        .map((tc: any) => tc.result);
      ctx.flag(`book_appointment вызван, но успеха нет. Result: ${JSON.stringify(bookRes).slice(0, 200)}`);
    } else {
      ctx.note('Запись успешно создана');
    }
  },
);

// ── Запуск ───────────────────────────────────────────────────────────────────

runAll(process.argv[2]).catch((e) => {
  console.error(e);
  process.exit(1);
});
