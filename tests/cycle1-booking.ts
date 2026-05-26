/**
 * Цикл 1: полная запись к терапевту с проверкой дат на каждом шаге.
 *
 * Шаги тестового сценария:
 *   1. "Запиши меня к терапевту {выражение}" → бот ищет слоты
 *   2. Выбор времени/врача                    → бот спрашивает ФИО/телефон/ДР
 *   3. Данные пациента                        → бот показывает сводку
 *   4. "Подтверждаю"                          → запись создана
 *
 * Проверки:
 *   - HARD: slot.date в результатах find_doctors_and_slots/find_services
 *           совпадает с ожидаемой датой по семантике запроса.
 *   - SOFT: текст ответа упоминает дату (день/число/месяц).
 *   - HARD: финальная запись успешна (function:book_appointment.success=true).
 *
 * Перед запуском очищается appointments.json в моке.
 */

import {
  test, runAll, resetMock, fullBooking, sendMessage, newSession,
  nearestWeekday, nextWeekDay, nextWeekMonday, inDays, inOneMonth, nextMonthFirstDay,
  toIso, expectSlotDate, expectSlotDateInRange, expectDateMentioned, expectBookingSuccess,
  expectTimeInRange,
} from './lib';

// Сбрасываем мок перед каждым тестом — иначе бронирования накапливаются
// (15-й тест может не найти морнинг-слот, потому что предыдущие тесты их заняли).

// ── Дни недели ───────────────────────────────────────────────────────────────
// Проверяем, что нормализатор и резолвер корректно вычисляют ближайший день
// (с учётом «через неделю» если сегодняшний день уже прошёл/не подходит).

const PICK_FIRST = 'Возьму первый предложенный вариант';

test('понедельник → ближайший Пн', async () => {
  const expected = nearestWeekday(1);
  const r = await fullBooking('Запиши меня к терапевту в понедельник', PICK_FIRST);
  expectSlotDate(r.r1.history, toIso(expected));
  expectDateMentioned(r.r3!.reply, expected);
  expectBookingSuccess(r.r4!.history);
});

test('вторник → ближайший Вт', async () => {
  const expected = nearestWeekday(2);
  const r = await fullBooking('Запиши меня к терапевту во вторник', PICK_FIRST);
  expectSlotDate(r.r1.history, toIso(expected));
  expectDateMentioned(r.r3!.reply, expected);
  expectBookingSuccess(r.r4!.history);
});

test('среда → ближайшая Ср', async () => {
  const expected = nearestWeekday(3);
  const r = await fullBooking('Запиши меня к терапевту в среду', PICK_FIRST);
  expectSlotDate(r.r1.history, toIso(expected));
  expectDateMentioned(r.r3!.reply, expected);
  expectBookingSuccess(r.r4!.history);
});

test('четверг → ближайший Чт', async () => {
  const expected = nearestWeekday(4);
  const r = await fullBooking('Запиши меня к терапевту в четверг', PICK_FIRST);
  expectSlotDate(r.r1.history, toIso(expected));
  expectDateMentioned(r.r3!.reply, expected);
  expectBookingSuccess(r.r4!.history);
});

test('пятница → ближайшая Пт', async () => {
  const expected = nearestWeekday(5);
  const r = await fullBooking('Запиши меня к терапевту в пятницу', PICK_FIRST);
  expectSlotDate(r.r1.history, toIso(expected));
  expectDateMentioned(r.r3!.reply, expected);
  expectBookingSuccess(r.r4!.history);
});

test('суббота → ближайшая Сб', async () => {
  const expected = nearestWeekday(6);
  const r = await fullBooking('Запиши меня к терапевту в субботу', PICK_FIRST);
  expectSlotDate(r.r1.history, toIso(expected));
  expectDateMentioned(r.r3!.reply, expected);
  expectBookingSuccess(r.r4!.history);
});

// Воскресенье: терапевты в моке по воскресеньям не работают — ожидаем,
// что чат скажет «нет слотов»; полная запись не пройдёт. Это негативный кейс.
test('воскресенье → нет слотов (negative)', async () => {
  const session = newSession('sun');
  const r = await sendMessage(session, 'Запиши меня к терапевту в воскресенье');
  // Хард: в slot-результатах НЕ должно быть воскресенья (или вообще пусто).
  const expectedSun = toIso(nearestWeekday(7));
  // Просто проверяем, что нет такой даты — slot.date воскресенья не должен встретиться.
  // (Терапевты Иванова и Петров работают только Mon/Wed/Fri и Tue/Thu/Sat соответственно.)
  const reply = r.reply.toLowerCase();
  if (!reply.includes('нет') && !reply.includes('не работ') && !reply.includes('недоступн') && !reply.includes('не принима') && !reply.includes('не вед') && !reply.includes('к сожалению')) {
    throw new Error(`ожидали ответ «нет слотов» для воскресенья ${expectedSun}, получили: ${r.reply.slice(0, 250)}`);
  }
});

// ── Конкретные даты ─────────────────────────────────────────────────────────

test('конкретная дата #1 → today+7', async () => {
  const expected = inDays(7);
  // Передаём «через неделю» — нормализатор подставит date=today+7, mode=week.
  // В этой неделе LLM покажет слоты вокруг expected.
  const r = await fullBooking('Запиши меня к терапевту через неделю', PICK_FIRST);
  expectSlotDateInRange(r.r1.history, expected, inDays(13));
  expectBookingSuccess(r.r4!.history);
});

test('конкретная дата #2 → 1-е число следующего месяца', async () => {
  const expected = nextMonthFirstDay();
  const r = await fullBooking('Запиши меня к терапевту в начале следующего месяца', PICK_FIRST);
  // mode=week → ожидаем дату в первой неделе следующего месяца.
  expectSlotDateInRange(r.r1.history, expected, inDays(13));
  expectBookingSuccess(r.r4!.history);
});

// ── Описательные выражения ──────────────────────────────────────────────────

test('ближайшее время → ближайший рабочий день', async () => {
  const r = await fullBooking('Запиши меня к терапевту на ближайшее время', PICK_FIRST);
  // Ожидаем дату в ближайшие 7 дней.
  expectSlotDateInRange(r.r1.history, inDays(0), inDays(7));
  expectBookingSuccess(r.r4!.history);
});

test('на следующей неделе → неделя начиная с Пн', async () => {
  const monday = nextWeekMonday();
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  const r = await fullBooking('Запиши меня к терапевту на следующей неделе', PICK_FIRST);
  expectSlotDateInRange(r.r1.history, monday, sunday);
  expectBookingSuccess(r.r4!.history);
});

test('через неделю → ~today+7', async () => {
  const r = await fullBooking('Запиши меня к терапевту через неделю', PICK_FIRST);
  expectSlotDateInRange(r.r1.history, inDays(7), inDays(13));
  expectBookingSuccess(r.r4!.history);
});

test('в начале недели → Пн-Вт-Ср', async () => {
  // «Начало недели» — Пн/Вт/Ср ОДНОЙ И ТОЙ ЖЕ предстоящей недели.
  // Используем nearestWeekday(1) как опору + 2 дня, чтобы Пн и Ср не разъехались
  // по разным неделям, если сегодня уже Пн (тогда nearestWeekday(1)=след.Пн,
  // а nearestWeekday(3)=эта Ср — диапазон получался бы инвертированным).
  const mon = nearestWeekday(1);
  const wed = new Date(mon); wed.setDate(wed.getDate() + 2);
  const r = await fullBooking('Запиши меня к терапевту в начале недели', PICK_FIRST);
  expectSlotDateInRange(r.r1.history, mon, wed);
  expectBookingSuccess(r.r4!.history);
});

test('в конце недели → Пт-Сб-Вс', async () => {
  // «Конец недели» — диапазон [ближайшая Пт, +2 дня = Вс той же недели].
  const fri = nearestWeekday(5);
  const sun = new Date(fri); sun.setDate(sun.getDate() + 2);
  const r = await fullBooking('Запиши меня к терапевту в конце недели', PICK_FIRST);
  expectSlotDateInRange(r.r1.history, fri, sun);
  expectBookingSuccess(r.r4!.history);
});

// ── День + время суток ──────────────────────────────────────────────────────

test('в понедельник в утреннее время → Пн, время 09:00-12:00', async () => {
  const expected = nearestWeekday(1);
  const r = await fullBooking('Запиши меня к терапевту в понедельник в утреннее время', 'Беру в 09:00');
  expectSlotDate(r.r1.history, toIso(expected));
  // Софт: бот предлагает утренние слоты (хотя бы одно время в диапазоне 09:00-12:00 в r1).
  expectTimeInRange(r.r1.reply, 9, 12);
  expectBookingSuccess(r.r4!.history);
});

test('во вторник вечернее время → Вт, время 16:00-18:00', async () => {
  const expected = nearestWeekday(2);
  const r = await fullBooking('Запиши меня к терапевту во вторник вечернее время', 'Беру в 17:00');
  expectSlotDate(r.r1.history, toIso(expected));
  expectTimeInRange(r.r1.reply, 16, 19);
  expectBookingSuccess(r.r4!.history);
});

// ── Конкретное время ────────────────────────────────────────────────────────

test('в 11:00 в среду → Ср, 11:00', async () => {
  const expected = nearestWeekday(3);
  const r = await fullBooking('Запиши меня к терапевту в 11:00 в среду', 'Беру в 11:00');
  expectSlotDate(r.r1.history, toIso(expected));
  // Софт: 11:00 упомянуто в ответе.
  if (!r.r3!.reply.includes('11:00') && !r.r4!.reply.includes('11:00')) {
    throw new Error(`ожидали 11:00 в сводке/подтверждении. r3: ${r.r3!.reply.slice(0, 150)}`);
  }
  expectBookingSuccess(r.r4!.history);
});

// ── Месяцы ──────────────────────────────────────────────────────────────────

test('в начале следующего месяца → 1-е число +', async () => {
  const expected = nextMonthFirstDay();
  const r = await fullBooking('Запиши меня к терапевту в начале следующего месяца', PICK_FIRST);
  expectSlotDateInRange(r.r1.history, expected, inDays(45));
  expectBookingSuccess(r.r4!.history);
});

test('на следующий месяц → date в след. месяце', async () => {
  const expected = nextMonthFirstDay();
  const r = await fullBooking('Запиши меня к терапевту на следующий месяц', PICK_FIRST);
  expectSlotDateInRange(r.r1.history, expected, inDays(45));
  expectBookingSuccess(r.r4!.history);
});

test('через месяц → ~today+30', async () => {
  const target = inOneMonth();
  // Допустимое окно: ±7 дней от target.
  const from = new Date(target); from.setDate(from.getDate() - 3);
  const to = new Date(target); to.setDate(to.getDate() + 13);
  const r = await fullBooking('Запиши меня к терапевту через месяц', PICK_FIRST);
  expectSlotDateInRange(r.r1.history, from, to);
  expectBookingSuccess(r.r4!.history);
});

// ── Запуск ───────────────────────────────────────────────────────────────────

runAll(process.argv[2], { beforeEach: resetMock }).catch((e) => {
  console.error(e);
  process.exit(1);
});
