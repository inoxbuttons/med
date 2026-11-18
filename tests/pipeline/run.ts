/**
 * Прогон сценариев нового движка (pipeline) на сети 2 с сохранением диалогов для оценки.
 * Вызывает модель (разбор реплик) — запуск по согласованию.
 *
 *   cd tests && npx ts-node pipeline/run.ts [ID ...]
 *
 * Нужно: бэкенд с CHAT_ALLOW_ENGINE_OVERRIDE=true на CHAT_API (по умолчанию localhost:3000),
 * docker-контейнер med-db-1 (проверки БД и токены). После прогона тестовые записи удаляются.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { CLIENT_ID, GUEST_PHONE, Scenario, SCENARIOS, Step } from './scenarios';

const API = process.env.CHAT_API ?? 'http://localhost:3000/chat/message';
const NET = 2;

interface Reply { reply: string; quickReplies?: Array<{ label: string; payload?: string }>; engine?: string }

/** Следы теста: клиент CLIENT_ID или гость по имени (телефон — запасной признак). */
const GUEST_NAME = 'Тестов Тест';
const MINE = `(patient_id = ${CLIENT_ID} OR comment LIKE '%${GUEST_NAME}%' OR comment LIKE '%${GUEST_PHONE}%')`;

function sql(q: string): string {
  return execFileSync('docker', ['exec', 'med-db-1', 'psql', '-U', 'root', '-d', 'med', '-tAc', q], { encoding: 'utf-8' }).trim();
}

/** Следы теста в БД: записи и заявки гостя (телефон в комментарии) и клиента CLIENT_ID. */
function footprint() {
  const n = (q: string) => Number(sql(q) || 0);
  return {
    appointments: n(`SELECT count(*) FROM appointments WHERE ${MINE}`),
    serviceAppointments: n(`SELECT count(*) FROM service_appointments WHERE ${MINE}`),
    operatorRequests: n(`SELECT count(*) FROM operator_requests WHERE patient_id = ${CLIENT_ID} OR patient_phone = '${GUEST_PHONE}' OR patient_name LIKE '%${GUEST_NAME}%'`),
  };
}

function cleanup() {
  sql(`DELETE FROM appointments WHERE ${MINE}`);
  sql(`DELETE FROM service_appointments WHERE ${MINE}`);
  sql(`DELETE FROM operator_requests WHERE patient_id = ${CLIENT_ID} OR patient_phone = '${GUEST_PHONE}' OR patient_name LIKE '%${GUEST_NAME}%'`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Бэкенд ограничивает 30 запросов в минуту (ThrottlerModule): держим темп и повторяем при 429. */
async function send(sessionId: string, message: string, client: boolean, payload?: string): Promise<Reply> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(2100);
    const r = await sendOnce(sessionId, message, client, payload);
    if (r !== 'throttled') return r;
    await sleep(15000);
  }
  throw new Error('HTTP 429 после повторов');
}

async function sendOnce(sessionId: string, message: string, client: boolean, payload?: string): Promise<Reply | 'throttled'> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, payload, clinicNetId: NET, engine: 'pipeline', ...(client ? { clientId: CLIENT_ID } : {}) }),
  });
  if (res.status === 429) return 'throttled';
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as Reply;
  // engine нет только у ответов защитных проверок ChatService (инъекция, пустое сообщение).
  if (data.engine && data.engine !== 'pipeline') throw new Error('Ответ не от pipeline — проверьте CHAT_ALLOW_ENGINE_OVERRIDE');
  return data;
}

function resolveStep(step: Step, last: Reply | null): { text: string; payload?: string; note?: string } {
  if (typeof step === 'string') return { text: step };
  if ('payload' in step) return { text: step.label, payload: step.payload };
  const buttons = last?.quickReplies ?? [];
  const btn = typeof step.button === 'number'
    ? buttons[step.button - 1]
    : buttons.find((b) => b.label.toLowerCase().includes(String(step.button).toLowerCase()));
  if (!btn) return { text: String(step.button), note: `кнопки «${step.button}» нет — отправлен текст` };
  return { text: btn.label, payload: btn.payload };
}

async function run(s: Scenario, outDir: string) {
  cleanup();
  const sessionId = `pipe-${s.id}-${Date.now()}`;
  const lines: string[] = [`# ${s.id} — ${s.title}`, '', `**Критерии:** ${s.criteria}`, ''];
  let last: Reply | null = null;
  const started = Date.now();
  let error: string | null = null;
  for (const step of s.steps) {
    const { text, payload, note } = resolveStep(step, last);
    lines.push(`**Пациент:** ${text}${payload ? `  \`[${payload}]\`` : ''}${note ? `  _(${note})_` : ''}`, '');
    try {
      const t0 = Date.now();
      last = await send(sessionId, text, !!s.client, payload);
      lines.push(`**Ассистент** _(${Date.now() - t0} мс)_:`, '', ...last.reply.split('\n').map((l) => `> ${l}`));
      if (last.quickReplies?.length) lines.push('', `Кнопки: ${last.quickReplies.map((b) => `[${b.label}]`).join(' ')}`);
      lines.push('');
    } catch (e) {
      error = String(e);
      lines.push(`**ОШИБКА:** ${error}`, '');
      break;
    }
  }
  const fp = footprint();
  const tokens = sql(`SELECT count(*) || ' вызовов, вход ' || COALESCE(sum(prompt_tokens),0) || ', выход ' || COALESCE(sum(completion_tokens),0) || ' — ' || COALESCE(string_agg(DISTINCT task, ','),'') FROM token_usage WHERE session_id = '${sessionId}'`);
  const got = fp.operatorRequests ? 'operator_request' : fp.appointments + fp.serviceAppointments > 0 ? 'booked' : 'nothing';
  const expected = s.expect ?? 'nothing';
  // cancelled — запись создана и отменена → следов нет; rescheduled — ровно одна запись.
  const hardOk = error === null && (
    expected === 'cancelled' || expected === 'nothing' ? got === 'nothing'
      : expected === 'rescheduled' ? fp.appointments + fp.serviceAppointments === 1
      : got === expected);
  lines.splice(3, 0, `**Ожидание БД:** ${expected} · **факт:** ${JSON.stringify(fp)} → ${hardOk ? 'OK' : 'FAIL'}`, `**Модель:** ${tokens} · **Время:** ${((Date.now() - started) / 1000).toFixed(1)} с`, '');
  fs.writeFileSync(path.join(outDir, `${s.id}.md`), lines.join('\n'));
  cleanup();
  return { id: s.id, title: s.title, hardOk, got, expected, tokens, error };
}

async function main() {
  const only = process.argv.slice(2);
  const list = only.length ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join(__dirname, '..', 'results', 'pipeline', stamp);
  fs.mkdirSync(outDir, { recursive: true });
  const summary = [];
  for (const s of list) {
    const r = await run(s, outDir);
    console.log(`${r.hardOk ? 'OK  ' : 'FAIL'} ${r.id.padEnd(4)} ${r.title} — БД: ${r.got} (ожид. ${r.expected}); ${r.tokens}${r.error ? ` — ${r.error}` : ''}`);
    summary.push(r);
  }
  const total = sql(`SELECT count(*) || ' вызовов, вход ' || COALESCE(sum(prompt_tokens),0) || ', выход ' || COALESCE(sum(completion_tokens),0) FROM token_usage WHERE session_id LIKE 'pipe-%' AND created_at > now() - interval '2 hours'`);
  fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), [
    `# Прогон pipeline, сеть ${NET}`, '', `Модель за прогон: ${total}`, '',
    '| ID | Сценарий | БД | Модель |', '|---|---|---|---|',
    ...summary.map((r) => `| ${r.id} | ${r.title} | ${r.hardOk ? 'OK' : 'FAIL'} (${r.got}) | ${r.tokens} |`),
  ].join('\n'));
  console.log(`\nИтого: ${summary.filter((r) => r.hardOk).length}/${summary.length} по БД; модель: ${total}\nДиалоги: ${outDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
