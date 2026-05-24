/**
 * Цикл 2: запросы на «Есть ли окно у терапевта {время}» — без записи.
 *
 * Каждый тест:
 *   - отправляет одну реплику
 *   - проверяет, что reply упоминает корректную дату (по семантике запроса)
 *   - проверяет, что slot.date в результатах find_doctors_and_slots
 *     укладывается в ожидаемое окно
 *
 * Цикл лёгкий (один LLM-вызов на тест), хорошо подходит для регулярных прогонов.
 */

import {
  test, runAll, sendMessage, newSession,
  nearestWeekday, nextWeekMonday, nextWeekDay, inDays, inOneMonth, nextMonthFirstDay,
  toIso, expectSlotDate, expectSlotDateInRange, expectDateMentioned,
  expectTimeInRange,
} from './lib';

const QUERY = (suffix: string) => `Есть ли окно у терапевта ${suffix}`;

async function ask(message: string) {
  const session = newSession('avail');
  return sendMessage(session, message);
}

// ── Дни недели ───────────────────────────────────────────────────────────────

test('окно в понедельник', async () => {
  const expected = nearestWeekday(1);
  const r = await ask(QUERY('в понедельник'));
  expectSlotDate(r.history, toIso(expected));
  expectDateMentioned(r.reply, expected);
});

test('окно во вторник', async () => {
  const expected = nearestWeekday(2);
  const r = await ask(QUERY('во вторник'));
  expectSlotDate(r.history, toIso(expected));
  expectDateMentioned(r.reply, expected);
});

test('окно в среду', async () => {
  const expected = nearestWeekday(3);
  const r = await ask(QUERY('в среду'));
  expectSlotDate(r.history, toIso(expected));
  expectDateMentioned(r.reply, expected);
});

test('окно в четверг', async () => {
  const expected = nearestWeekday(4);
  const r = await ask(QUERY('в четверг'));
  expectSlotDate(r.history, toIso(expected));
  expectDateMentioned(r.reply, expected);
});

test('окно в пятницу', async () => {
  const expected = nearestWeekday(5);
  const r = await ask(QUERY('в пятницу'));
  expectSlotDate(r.history, toIso(expected));
  expectDateMentioned(r.reply, expected);
});

test('окно в субботу', async () => {
  const expected = nearestWeekday(6);
  const r = await ask(QUERY('в субботу'));
  expectSlotDate(r.history, toIso(expected));
  expectDateMentioned(r.reply, expected);
});

test('окно в воскресенье — нет приёма', async () => {
  const r = await ask(QUERY('в воскресенье'));
  const reply = r.reply.toLowerCase();
  if (!reply.includes('нет') && !reply.includes('не работ') && !reply.includes('недоступ') && !reply.includes('не принима') && !reply.includes('не вед') && !reply.includes('к сожалению')) {
    throw new Error(`ожидали ответ «нет слотов» для воскресенья, получили: ${r.reply.slice(0, 250)}`);
  }
});

// ── Конкретные даты ─────────────────────────────────────────────────────────

test('окно через неделю → today+7', async () => {
  const r = await ask(QUERY('через неделю'));
  expectSlotDateInRange(r.history, inDays(7), inDays(13));
});

test('окно в начале следующего месяца → 1-е число +', async () => {
  const expected = nextMonthFirstDay();
  const r = await ask(QUERY('в начале следующего месяца'));
  expectSlotDateInRange(r.history, expected, inDays(45));
});

// ── Описательные ────────────────────────────────────────────────────────────

test('окно на ближайшее время → ближайшие 7 дней', async () => {
  const r = await ask(QUERY('на ближайшее время'));
  expectSlotDateInRange(r.history, inDays(0), inDays(7));
});

test('окно на следующей неделе → след. неделя', async () => {
  const monday = nextWeekMonday();
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  const r = await ask(QUERY('на следующей неделе'));
  expectSlotDateInRange(r.history, monday, sunday);
});

test('окно через неделю (повтор)', async () => {
  const r = await ask(QUERY('через неделю'));
  expectSlotDateInRange(r.history, inDays(7), inDays(13));
});

test('окно в начале недели → Пн-Ср', async () => {
  const mon = nearestWeekday(1);
  const wed = nearestWeekday(3);
  const r = await ask(QUERY('в начале недели'));
  expectSlotDateInRange(r.history, mon, wed);
});

test('окно в конце недели → Пт-Вс', async () => {
  // «Конец недели» — диапазон [ближайшая Пт, +2 дня = Вс той же недели].
  // (Если today=Пт, fri будет в следующей неделе → диапазон тоже сдвигается.)
  const fri = nearestWeekday(5);
  const sun = new Date(fri); sun.setDate(sun.getDate() + 2);
  const r = await ask(QUERY('в конце недели'));
  expectSlotDateInRange(r.history, fri, sun);
});

// ── День + время суток ─────────────────────────────────────────────────────

test('окно в понедельник утром → Пн + 09:00-12:00', async () => {
  const expected = nearestWeekday(1);
  const r = await ask(QUERY('в понедельник в утреннее время'));
  expectSlotDate(r.history, toIso(expected));
  expectTimeInRange(r.reply, 9, 12);
});

test('окно во вторник вечером → Вт + 16:00-18:00', async () => {
  const expected = nearestWeekday(2);
  const r = await ask(QUERY('во вторник вечернее время'));
  expectSlotDate(r.history, toIso(expected));
  expectTimeInRange(r.reply, 16, 19);
});

// ── Конкретное время ───────────────────────────────────────────────────────

test('окно в 11:00 в среду → Ср, 11:00 в ответе', async () => {
  const expected = nearestWeekday(3);
  const r = await ask(QUERY('в 11:00 в среду'));
  expectSlotDate(r.history, toIso(expected));
  if (!r.reply.includes('11:00')) {
    throw new Error(`ожидали 11:00 в ответе, получили: ${r.reply.slice(0, 250)}`);
  }
});

// ── Месяцы ─────────────────────────────────────────────────────────────────

test('окно в начале следующего месяца → 1-е число +', async () => {
  const expected = nextMonthFirstDay();
  const r = await ask(QUERY('в начале следующего месяца'));
  expectSlotDateInRange(r.history, expected, inDays(45));
});

test('окно на следующий месяц → след. месяц', async () => {
  const expected = nextMonthFirstDay();
  const r = await ask(QUERY('на следующий месяц'));
  expectSlotDateInRange(r.history, expected, inDays(45));
});

test('окно через месяц → ~today+30', async () => {
  const target = inOneMonth();
  const from = new Date(target); from.setDate(from.getDate() - 3);
  const to = new Date(target); to.setDate(to.getDate() + 13);
  const r = await ask(QUERY('через месяц'));
  expectSlotDateInRange(r.history, from, to);
});

// ── Запуск ──────────────────────────────────────────────────────────────────

runAll(process.argv[2]).catch((e) => {
  console.error(e);
  process.exit(1);
});
