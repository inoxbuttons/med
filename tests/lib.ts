/**
 * Общие хелперы для интеграционных тестов чата.
 *  - sendMessage / newSession — HTTP-клиент к /chat/message
 *  - date-helpers — ожидаемые даты от «сегодня»
 *  - assertions — проверки дат в reply и в результатах tool-вызовов
 *  - test/runAll — минимальный test-runner
 *  - resetMock — очистка appointments.json перед запуском
 */

import * as fs from 'fs';
import * as path from 'path';

// ── HTTP-клиент ──────────────────────────────────────────────────────────────

const API_URL = process.env.CHAT_API ?? 'http://localhost:3000/chat/message';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: { name: string; arguments: string };
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  history: ChatMessage[];
}

export async function sendMessage(sessionId: string, message: string): Promise<ChatResponse> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      message,
      clinicNetId: 1,
      misType: 'medflex',
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  return (await res.json()) as ChatResponse;
}

export function newSession(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Date helpers ─────────────────────────────────────────────────────────────

const MONTHS_GEN = ['', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const DAYS_LOWER = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

/** Сегодня в локальном времени (полночь). */
export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Ближайший день недели (1=Пн..7=Вс), не сегодня. */
export function nearestWeekday(target: number): Date {
  const d = today();
  const js = d.getDay();
  const currentRu = js === 0 ? 7 : js;
  let diff = (target - currentRu + 7) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Понедельник следующей календарной недели. */
export function nextWeekMonday(): Date {
  const d = today();
  const js = d.getDay();
  const currentRu = js === 0 ? 7 : js;
  let toNextMon = (1 - currentRu + 7) % 7;
  if (toNextMon === 0) toNextMon = 7;
  d.setDate(d.getDate() + toNextMon);
  return d;
}

/** Конкретный день недели следующей календарной недели. */
export function nextWeekDay(target: number): Date {
  const d = nextWeekMonday();
  d.setDate(d.getDate() + (target - 1));
  return d;
}

/** Сегодня + N дней. */
export function inDays(n: number): Date {
  const d = today();
  d.setDate(d.getDate() + n);
  return d;
}

/** Сегодня + 1 месяц (тот же день). */
export function inOneMonth(): Date {
  const d = today();
  d.setMonth(d.getMonth() + 1);
  return d;
}

/** 1-е число следующего месяца. */
export function nextMonthFirstDay(): Date {
  const d = today();
  d.setMonth(d.getMonth() + 1, 1);
  return d;
}

/** "YYYY-MM-DD" */
export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "25 мая" */
export function ruDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth() + 1]}`;
}

/** "понедельник" */
export function ruDayOfWeek(d: Date): string {
  return DAYS_LOWER[d.getDay()];
}

// ── Извлечение информации из истории ────────────────────────────────────────

/** Все slot.date из результатов find_doctors_and_slots / find_services / get_available_slots. */
export function getSlotDates(history: ChatMessage[]): string[] {
  const dates: string[] = [];
  for (const m of history) {
    if (m.role !== 'function') continue;
    if (!['find_doctors_and_slots', 'find_services', 'get_available_slots', 'find_available_at_time'].includes(m.name ?? '')) continue;
    try {
      const parsed = JSON.parse(m.content);
      const arr = Array.isArray(parsed) ? parsed : (parsed?.available ?? parsed?.nearest ?? []);
      for (const r of arr) {
        if (r.slot?.date) dates.push(r.slot.date);
        if (r.date) dates.push(r.date); // get_available_slots returns groups with `date`
      }
    } catch { /* ignore */ }
  }
  return dates;
}

/** Все аргументы date/dayOfWeek из tool-вызовов LLM. */
export function getToolDateArgs(history: ChatMessage[]): Array<{ tool: string; args: any }> {
  const out: Array<{ tool: string; args: any }> = [];
  for (const m of history) {
    if (m.role === 'assistant' && m.function_call) {
      try {
        const args = JSON.parse(m.function_call.arguments);
        out.push({ tool: m.function_call.name, args });
      } catch { /* ignore */ }
    }
  }
  return out;
}

/** Был ли успешный book_appointment в истории. */
export function hasSuccessfulBooking(history: ChatMessage[]): boolean {
  for (const m of history) {
    if (m.role === 'function' && m.name === 'book_appointment') {
      try {
        const r = JSON.parse(m.content);
        if (r.success === true && r.uuid) return true;
      } catch { /* ignore */ }
    }
  }
  return false;
}

// ── Assertions ───────────────────────────────────────────────────────────────

/** Хард-проверка: один из ожидаемых ISO-дат должен быть в slot-результатах. */
export function expectSlotDate(history: ChatMessage[], expectedIso: string | string[]): void {
  const expected = Array.isArray(expectedIso) ? expectedIso : [expectedIso];
  const got = getSlotDates(history);
  if (!expected.some((e) => got.includes(e))) {
    throw new Error(`expectSlotDate: ожидали одну из дат [${expected.join(', ')}], получили в slot-результатах [${got.join(', ')}]`);
  }
}

// Корень дня недели — чтобы поймать любые падежи («пятницу», «пятницы», «пятнице»).
const DAY_STEM: Record<string, string> = {
  понедельник: 'понедельник',
  вторник: 'вторник',
  среда: 'сред',
  четверг: 'четверг',
  пятница: 'пятниц',
  суббота: 'суббот',
  воскресенье: 'воскресень',
};

/** Софт-проверка: текст ответа упоминает дату (в любом из форматов: "25 мая", "пятниц*", "2026-05-25"). */
export function expectDateMentioned(reply: string, d: Date): void {
  const ruDate = ruDayMonth(d).toLowerCase();
  const ruDay = ruDayOfWeek(d);
  const iso = toIso(d);
  const stem = DAY_STEM[ruDay] ?? ruDay;
  const lower = reply.toLowerCase();
  if (!lower.includes(ruDate) && !lower.includes(stem) && !lower.includes(iso)) {
    throw new Error(`expectDateMentioned: ожидали в ответе "${ruDate}" / "${stem}*" / "${iso}". Ответ: ${reply.slice(0, 250)}`);
  }
}

/** Хард-проверка: в reply есть time-of-day в указанном диапазоне (HH:00 ≤ x < HH:00). */
export function expectTimeInRange(reply: string, fromHour: number, toHour: number): void {
  const matches = [...reply.matchAll(/(\d{1,2}):(\d{2})/g)];
  const inRange = matches.some(([, h]) => {
    const hour = parseInt(h, 10);
    return hour >= fromHour && hour < toHour;
  });
  if (!inRange) {
    throw new Error(`expectTimeInRange: не нашли время в диапазоне [${fromHour}:00, ${toHour}:00). Ответ: ${reply.slice(0, 250)}`);
  }
}

/** Хард-проверка: booking успешен (в истории есть function:book_appointment с success=true). */
export function expectBookingSuccess(history: ChatMessage[]): void {
  if (!hasSuccessfulBooking(history)) {
    throw new Error('expectBookingSuccess: успешного book_appointment в истории нет');
  }
}

/** Хард-проверка: дата в результате попадает в диапазон [from, to] включительно. */
export function expectSlotDateInRange(history: ChatMessage[], from: Date, to: Date): void {
  const isoFrom = toIso(from);
  const isoTo = toIso(to);
  const got = getSlotDates(history);
  const inRange = got.some((iso) => iso >= isoFrom && iso <= isoTo);
  if (!inRange) {
    throw new Error(`expectSlotDateInRange: ожидали дату в [${isoFrom}, ${isoTo}], получили [${got.join(', ')}]`);
  }
}

// ── Booking helpers ─────────────────────────────────────────────────────────

/** Тестовые данные пациента (гостевой режим). */
export const TEST_PATIENT_LINE = 'Тестов Тест Тестович, 79991234567, 1 января 1990';

export interface BookingSteps {
  r1: ChatResponse; // после initial request
  r2?: ChatResponse; // после picking slot
  r3?: ChatResponse; // после данных пациента
  r4?: ChatResponse; // после подтверждения
}

/**
 * Полный flow записи:
 *   1) initialRequest → ответ со слотами
 *   2) pickPhrase     → бот спрашивает данные
 *   3) данные         → бот показывает сводку
 *   4) "Подтверждаю"  → бот подтверждает запись
 */
export async function fullBooking(initialRequest: string, pickPhrase: string): Promise<BookingSteps> {
  const session = newSession('booking');
  const r1 = await sendMessage(session, initialRequest);
  const r2 = await sendMessage(session, pickPhrase);
  const r3 = await sendMessage(session, TEST_PATIENT_LINE);
  const r4 = await sendMessage(session, 'Подтверждаю');
  return { r1, r2, r3, r4 };
}

// ── TestContext — recording-aware test scaffolding ──────────────────────────

export interface Turn {
  user: string;
  reply: string;
  toolCalls: Array<{ name: string; args: any; result: any }>;
  /** Срез истории, относящийся к этому ходу (от user-msg до конца reply). */
  slice: ChatMessage[];
  tookMs: number;
}

/**
 * Контекст одного теста: захватывает все ходы для последующей записи в Markdown
 * и автоматического прогона эвристик. Используется в cycle3+ тестах.
 */
export class TestContext {
  readonly testId: string;
  readonly scenario: string;
  readonly cycle: string;
  readonly sessionId: string;
  readonly startedAt: number;
  readonly turns: Turn[] = [];
  readonly flags: string[] = [];
  readonly hardErrors: string[] = [];
  /** Произвольные заметки тестового кода — попадают в отчёт. */
  readonly notes: string[] = [];
  /** Последняя полная история (для post-hoc HARD-ассертов). */
  lastHistory: ChatMessage[] = [];
  status: 'PASS' | 'FAIL' = 'PASS';
  durationMs = 0;

  constructor(testId: string, scenario: string, cycle: string) {
    this.testId = testId;
    this.scenario = scenario;
    this.cycle = cycle;
    this.sessionId = newSession(testId);
    this.startedAt = Date.now();
  }

  async user(message: string): Promise<ChatResponse> {
    const t0 = Date.now();
    const r = await sendMessage(this.sessionId, message);
    // Срез истории, относящийся к этому ходу: от нашей user-msg до конца.
    // (Делаем поиск с конца — устойчивость к фолдам/компакту.)
    let startIdx = -1;
    for (let i = r.history.length - 1; i >= 0; i--) {
      const m = r.history[i];
      if (m.role === 'user' && m.content === message) {
        startIdx = i;
        break;
      }
    }
    const slice = startIdx >= 0 ? r.history.slice(startIdx) : r.history;
    const toolCalls = extractToolCalls(slice);
    this.turns.push({
      user: message,
      reply: r.reply,
      toolCalls,
      slice,
      tookMs: Date.now() - t0,
    });
    this.lastHistory = r.history;
    return r;
  }

  flag(text: string): void { this.flags.push(text); }
  note(text: string): void { this.notes.push(text); }
  fail(text: string): void { this.hardErrors.push(text); this.status = 'FAIL'; }
}

/** Извлекает tool-вызовы из среза истории. */
function extractToolCalls(msgs: ChatMessage[]): Array<{ name: string; args: any; result: any }> {
  const out: Array<{ name: string; args: any; result: any }> = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== 'assistant' || !m.function_call) continue;
    let args: any = {};
    try { args = JSON.parse(m.function_call.arguments); } catch { /* ignore */ }
    let result: any = null;
    const next = msgs[i + 1];
    if (next?.role === 'function' && next.name === m.function_call.name) {
      try { result = JSON.parse(next.content); } catch { result = next.content; }
    }
    out.push({ name: m.function_call.name, args, result });
  }
  return out;
}

// ── Heuristics — детекторы подозрительного поведения для пометки в отчёте ──

const ENGLISH_WORDS_RE = /\b(places?|available|doctor|appointment|slots?|selected|booked|confirmation|cancel(l?ed|ling)?|patient|successful(ly)?|please|sorry|sure|okay)\b/i;
const VARIABLE_LEAK_RE = /\b(selected_\w+|var_\w+|chosen_\w+)\b|^\s*\w+\s*=\s*["'\d]/m;

const PLACEHOLDER_LABELS = ['имя', 'фамилия', 'отчество', 'фио', 'телефон', 'дата рождения', 'др'];

function runHeuristics(ctx: TestContext): string[] {
  const flags: string[] = [];

  // 1) Английские слова в reply
  ctx.turns.forEach((t, i) => {
    const m = t.reply.match(ENGLISH_WORDS_RE);
    if (m) flags.push(`Turn ${i + 1}: English word "${m[0]}" в reply`);
  });

  // 2) Утечка «переменных» / JSON / кода в reply
  ctx.turns.forEach((t, i) => {
    if (VARIABLE_LEAK_RE.test(t.reply)) {
      flags.push(`Turn ${i + 1}: похоже на код/переменную в reply (${t.reply.slice(0, 80).replace(/\n/g, ' ')}…)`);
    }
  });

  // 3) Плейсхолдеры в args book_appointment
  ctx.turns.forEach((t, i) => {
    for (const tc of t.toolCalls) {
      if (tc.name !== 'book_appointment') continue;
      for (const [k, v] of Object.entries(tc.args ?? {})) {
        if (typeof v !== 'string') continue;
        const s = v.trim();
        if (/^[{<].*[}>]$/.test(s) || PLACEHOLDER_LABELS.includes(s.toLowerCase())) {
          flags.push(`Turn ${i + 1}: плейсхолдер в book_appointment.${k}="${v}"`);
        }
      }
    }
  });

  // 4) Зацикленные tool-вызовы (одни и те же args ≥3 раза за тест)
  const callCount = new Map<string, number>();
  for (const t of ctx.turns) {
    for (const tc of t.toolCalls) {
      const key = `${tc.name}:${JSON.stringify(tc.args)}`;
      callCount.set(key, (callCount.get(key) ?? 0) + 1);
    }
  }
  for (const [key, n] of callCount) {
    if (n >= 3) flags.push(`Tool-call повторён ${n}× с теми же args: ${key.slice(0, 100)}`);
  }

  // 5) Дата в reply не соответствует ни одному slot.date в результатах
  //    (LLM сказала «23 мая», а в slot.date был «22 мая»)
  const monthMap: Record<string, number> = {
    'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4, 'мая': 5, 'июня': 6,
    'июля': 7, 'августа': 8, 'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12,
  };
  const allSlotDates = new Set<string>();
  for (const t of ctx.turns) {
    for (const tc of t.toolCalls) {
      const arr = Array.isArray(tc.result) ? tc.result : [];
      for (const r of arr) {
        if (r?.slot?.date) allSlotDates.add(r.slot.date);
        if (r?.date) allSlotDates.add(r.date);
      }
    }
  }
  if (allSlotDates.size > 0) {
    ctx.turns.forEach((t, i) => {
      const dateMatches = [...t.reply.matchAll(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/gi)];
      for (const m of dateMatches) {
        const dd = parseInt(m[1], 10);
        const mm = monthMap[m[2].toLowerCase()];
        const matches = [...allSlotDates].some((iso) => {
          const [, mIso, dIso] = iso.split('-').map(Number);
          return mIso === mm && dIso === dd;
        });
        if (!matches) {
          flags.push(`Turn ${i + 1}: дата "${m[0]}" в reply не совпадает ни с одной slot.date (${[...allSlotDates].join(', ')})`);
        }
      }
    });
  }

  // 6) book_appointment с success:false по причине, отличной от confirmation_required / patient_data_required / invalid_slot_date
  ctx.turns.forEach((t, i) => {
    for (const tc of t.toolCalls) {
      if (tc.name !== 'book_appointment') continue;
      const r = tc.result;
      if (!r || r.success !== false) continue;
      const okReasons = new Set(['confirmation_required', 'patient_data_required', 'missing_target', 'invalid_slot_date']);
      const reason = r.reason ?? '';
      if (!okReasons.has(reason) && !r.conflict) {
        flags.push(`Turn ${i + 1}: book_appointment failed reason="${reason}" message="${(r.message ?? '').slice(0, 100)}"`);
      }
    }
  });

  // 7) Галлюцинированный успех: reply содержит «успешно/оформлено/перенесено/отменено», но
  //    в этом ходе или раньше нет успешного book/cancel/reschedule.
  const claimRe = /(успешно\s+(оформ|записа|перенес|отмен|подтвержд|создан)|оформлен[аоы]?|записан[аоы]?|отменен[аоы]?|перенесен[аоы]?|подтверждена)/i;
  ctx.turns.forEach((t, i) => {
    if (!claimRe.test(t.reply)) return;
    const upTo = ctx.turns.slice(0, i + 1);
    const hasSuccess = upTo.some((tt) =>
      tt.toolCalls.some((tc) =>
        ['book_appointment', 'cancel_appointment', 'reschedule_appointment'].includes(tc.name) &&
        tc.result?.success === true,
      ),
    );
    if (!hasSuccess) {
      flags.push(`Turn ${i + 1}: reply содержит claim успеха («оформлено/перенесено/отменено»), но ни одного успешного book/cancel/reschedule в истории нет — возможна галлюцинация`);
    }
  });

  // 8) startTime mismatch: book_appointment.startTime содержит дату, которой нет
  //    ни в одном недавнем slot.date / allSlots / dtSlot.dt_start.
  const validDates = new Set<string>();
  for (const t of ctx.turns) {
    for (const tc of t.toolCalls) {
      const arr = Array.isArray(tc.result) ? tc.result : [];
      for (const r of arr) {
        if (r?.slot?.date) validDates.add(r.slot.date);
        if (r?.date) validDates.add(r.date);
        if (Array.isArray(r?.allSlots)) {
          for (const s of r.allSlots) {
            if (s?.date) validDates.add(s.date);
            if (s?.dtSlot?.dt_start) validDates.add(String(s.dtSlot.dt_start).slice(0, 10));
          }
        }
      }
    }
  }
  if (validDates.size > 0) {
    ctx.turns.forEach((t, i) => {
      for (const tc of t.toolCalls) {
        if (tc.name !== 'book_appointment') continue;
        const st = tc.args?.startTime;
        if (typeof st !== 'string') continue;
        const date = st.slice(0, 10);
        if (!validDates.has(date)) {
          flags.push(`Turn ${i + 1}: book_appointment.startTime="${st}" — дата ${date} НЕ в известных slot.date (${[...validDates].sort().join(', ')})`);
        }
      }
    });
  }

  return flags;
}

// ── Report writer (Markdown) ────────────────────────────────────────────────

let _cycleName = 'unknown';
export function setCycle(name: string): void {
  _cycleName = name;
  // Создаём папку результатов
  fs.mkdirSync(path.resolve(__dirname, 'results', name), { recursive: true });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-zа-я0-9\-]+/giu, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
}

function blockquote(s: string): string {
  return s.split('\n').map((l) => `> ${l}`).join('\n');
}

function writeReport(ctx: TestContext): void {
  const lines: string[] = [];
  lines.push(`# ${ctx.testId}`);
  lines.push('');
  if (ctx.scenario) {
    lines.push(`**Сценарий:** ${ctx.scenario}`);
    lines.push('');
  }
  lines.push(`**Status:** ${ctx.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  lines.push(`**Duration:** ${ctx.durationMs}ms · **Turns:** ${ctx.turns.length} · **Tool calls:** ${ctx.turns.reduce((s, t) => s + t.toolCalls.length, 0)}`);
  lines.push(`**Session:** \`${ctx.sessionId}\``);
  lines.push('');

  if (ctx.hardErrors.length) {
    lines.push('## ❌ Hard check failures');
    for (const e of ctx.hardErrors) lines.push(`- ${e}`);
    lines.push('');
  }

  if (ctx.flags.length) {
    lines.push('## ⚠️ Эвристические флаги');
    for (const f of ctx.flags) lines.push(`- ${f}`);
    lines.push('');
  }

  if (ctx.notes.length) {
    lines.push('## 📝 Заметки');
    for (const n of ctx.notes) lines.push(`- ${n}`);
    lines.push('');
  }

  lines.push('## Диалог');
  lines.push('');
  ctx.turns.forEach((t, i) => {
    lines.push(`### Turn ${i + 1} · ${t.tookMs}ms`);
    lines.push('');
    lines.push(`**User:** ${t.user}`);
    lines.push('');
    lines.push(`**Assistant:**`);
    lines.push('');
    lines.push(blockquote(t.reply));
    lines.push('');
    if (t.toolCalls.length) {
      lines.push(`**Tool calls (${t.toolCalls.length}):**`);
      for (const tc of t.toolCalls) {
        const argsStr = JSON.stringify(tc.args);
        const resStr = tc.result === null ? 'null' : JSON.stringify(tc.result);
        const resTruncated = resStr.length > 400 ? resStr.slice(0, 400) + '…' : resStr;
        lines.push('');
        lines.push(`- \`${tc.name}\` args: \`${argsStr}\``);
        lines.push(`  result: \`${resTruncated}\``);
      }
      lines.push('');
    }
  });

  const file = path.resolve(__dirname, 'results', ctx.cycle, `${slug(ctx.testId)}.md`);
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}

function writeIndex(results: TestContext[]): void {
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.length - passed;
  const totalFlags = results.reduce((s, r) => s + r.flags.length, 0);

  const lines: string[] = [];
  lines.push(`# Cycle ${_cycleName} — index`);
  lines.push('');
  lines.push(`**Total:** ${results.length} · **Pass:** ${passed} · **Fail:** ${failed} · **Flags total:** ${totalFlags}`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| # | Test | Status | Turns | Tools | Flags | Hard errors | Duration |');
  lines.push('|---|---|---|---:|---:|---:|---:|---:|');
  results.forEach((r, i) => {
    const tc = r.turns.reduce((s, t) => s + t.toolCalls.length, 0);
    const file = `${slug(r.testId)}.md`;
    const status = r.status === 'PASS' ? '✅' : '❌';
    lines.push(`| ${i + 1} | [${r.testId}](${file}) | ${status} | ${r.turns.length} | ${tc} | ${r.flags.length} | ${r.hardErrors.length} | ${r.durationMs}ms |`);
  });
  lines.push('');

  // Сводка флагов по группам
  if (totalFlags > 0) {
    lines.push('## Топ-флаги по типам');
    const categories = new Map<string, number>();
    for (const r of results) {
      for (const f of r.flags) {
        const key = f.split(':').slice(1, 2).join(':').trim().split(' ').slice(0, 3).join(' ') || f.split(' ').slice(0, 4).join(' ');
        categories.set(key, (categories.get(key) ?? 0) + 1);
      }
    }
    const sorted = [...categories.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cat, n] of sorted.slice(0, 15)) {
      lines.push(`- \`${cat}\` × ${n}`);
    }
    lines.push('');
  }

  const file = path.resolve(__dirname, 'results', _cycleName, 'INDEX.md');
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
}

// ── Test runner ──────────────────────────────────────────────────────────────

type TestFn = (ctx: TestContext) => Promise<void>;
type TestCase = { name: string; scenario: string; fn: TestFn };
const tests: TestCase[] = [];

/** Регистрация теста. Сценарий опционален. */
export function test(name: string, scenarioOrFn: string | TestFn, maybeFn?: TestFn): void {
  if (typeof scenarioOrFn === 'string') {
    tests.push({ name, scenario: scenarioOrFn, fn: maybeFn! });
  } else {
    tests.push({ name, scenario: '', fn: scenarioOrFn });
  }
}

const c = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

export async function runAll(filter?: string): Promise<void> {
  const t0 = Date.now();
  let passed = 0;
  let failed = 0;
  const failures: Array<{ name: string; err: string }> = [];
  const results: TestContext[] = [];

  for (const t of tests) {
    if (filter && !t.name.toLowerCase().includes(filter.toLowerCase())) continue;
    process.stdout.write(`${c.gray}▸${c.reset} ${t.name} `);
    const ctx = new TestContext(t.name, t.scenario, _cycleName);

    try {
      await t.fn(ctx);
      // Если тест не сложил hardErrors сам — статус PASS.
      if (ctx.hardErrors.length === 0) ctx.status = 'PASS';
    } catch (e: any) {
      ctx.status = 'FAIL';
      ctx.hardErrors.push(`Uncaught: ${e?.message ?? String(e)}`);
    }
    ctx.durationMs = Date.now() - ctx.startedAt;

    // Прогон эвристик после теста.
    const heuristicFlags = runHeuristics(ctx);
    ctx.flags.push(...heuristicFlags);

    // Запись отчёта (если cycle настроен).
    if (_cycleName !== 'unknown') {
      try { writeReport(ctx); } catch (e: any) { console.warn(`writeReport failed: ${e.message}`); }
    }

    results.push(ctx);

    if (ctx.status === 'PASS') {
      const flagSuffix = ctx.flags.length ? ` ${c.yellow}(${ctx.flags.length} flags)${c.reset}` : '';
      console.log(`${c.green}PASS${c.reset} ${c.gray}(${ctx.durationMs}ms)${c.reset}${flagSuffix}`);
      passed++;
    } else {
      console.log(`${c.red}FAIL${c.reset} ${c.gray}(${ctx.durationMs}ms)${c.reset}`);
      for (const e of ctx.hardErrors) console.log(`  ${c.red}${e}${c.reset}`);
      failed++;
      failures.push({ name: t.name, err: ctx.hardErrors.join('; ') });
    }
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${c.bold}${passed}/${passed + failed} passed${c.reset} ${c.gray}(${dt}s)${c.reset}`);

  // Индекс.
  if (_cycleName !== 'unknown' && results.length > 0) {
    try {
      writeIndex(results);
      console.log(`${c.gray}Reports: tests/results/${_cycleName}/${c.reset}`);
    } catch (e: any) { console.warn(`writeIndex failed: ${e.message}`); }
  }

  if (failures.length > 0) {
    console.log(`\n${c.bold}Failed:${c.reset}`);
    for (const f of failures) console.log(`  ${c.red}✗${c.reset} ${f.name}`);
    process.exit(1);
  }
}

// ── Mock state reset ─────────────────────────────────────────────────────────

const MOCK_APPTS = path.resolve(__dirname, '../medflex-mock/data/appointments.json');

/** Очищает appointments.json в medflex-mock — чтобы тесты не упирались в 409 conflict. */
export function resetMock(): void {
  fs.writeFileSync(MOCK_APPTS, '[]\n', 'utf8');
}

/** Читает текущее состояние appointments.json — для проверки реального эффекта в моке. */
export function readMockAppointments(): Array<{
  uuid: string;
  doctor_id: number;
  lpu_id: number;
  speciality_id: number;
  dt_start: string;
  dt_end: string;
  price: number;
  canceled: boolean;
  client: { first_name: string; last_name: string; second_name?: string; mobile_phone: string; birthday: string };
}> {
  try {
    const raw = fs.readFileSync(MOCK_APPTS, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Только активные (не отменённые) записи. */
export function activeMockAppointments(): ReturnType<typeof readMockAppointments> {
  return readMockAppointments().filter((a) => !a.canceled);
}
