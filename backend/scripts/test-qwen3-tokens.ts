/**
 * Скрипт для замера токенов Qwen3-235B-A22B на cloud.ru.
 * Запуск: npx ts-node scripts/test-qwen3-tokens.ts
 *
 * Тестирует 3 сценария:
 *   1. Короткий — 1 вопрос ("Хочу записаться к терапевту")
 *   2. Средний — 3 хода ("уточни дату", "на завтра", "подтверди")
 *   3. Длинный  — полный флоу записи с tool-call-симуляцией
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

const apiKey   = process.env.QWEN3_API_KEY ?? '';
const baseURL  = process.env.QWEN3_BASE_URL ?? 'https://foundation-models.api.cloud.ru/v1';
const model    = process.env.QWEN3_MODEL    ?? 'qwen/qwen3-235b-a22b';

const client = new OpenAI({ apiKey, baseURL });

const systemPrompt = fs.readFileSync(
  path.resolve(__dirname, '../src/prompts/system-prompt.txt'),
  'utf-8',
).trim();

const today = new Date().toISOString().slice(0, 10);
const systemWithDate =
  `${systemPrompt}\nСегодня: ${today} (Четверг). ` +
  `Для слов "вторник"/"завтра"/"послезавтра" используй dayOfWeek; date — только для явных дат с числом.`;

// Инструменты — только базовые для теста
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'find_doctors_and_slots',
      description: 'Найти врача и доступные слоты для записи',
      parameters: {
        type: 'object',
        properties: {
          speciality: { type: 'string', description: 'Специальность врача' },
          date:       { type: 'string', description: 'Дата в формате YYYY-MM-DD' },
          dayOfWeek:  { type: 'string', description: 'День недели' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Забронировать запись к врачу',
      parameters: {
        type: 'object',
        properties: {
          doctorId:  { type: 'number' },
          clinicId:  { type: 'number' },
          startTime: { type: 'string' },
        },
        required: ['doctorId', 'clinicId', 'startTime'],
      },
    },
  },
];

type Msg = OpenAI.Chat.ChatCompletionMessageParam;

interface TestResult {
  scenario: string;
  turns: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimateUsd: number;
  reply: string;
}

// Цена Qwen3-235B-A22B на cloud.ru (приблизительно, уточни на сайте)
const PRICE_INPUT_PER_1M  = 0.60;  // $ за 1M input tokens
const PRICE_OUTPUT_PER_1M = 2.00;  // $ за 1M output tokens

async function runScenario(
  name: string,
  messages: Msg[],
  withTools = false,
): Promise<TestResult> {
  let totalPrompt     = 0;
  let totalCompletion = 0;
  let lastReply       = '';
  const history       = [...messages];

  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: history,
    ...(withTools ? { tools, tool_choice: 'auto' } : {}),
  };

  const response = await client.chat.completions.create(params);
  const usage    = response.usage!;
  totalPrompt     += usage.prompt_tokens;
  totalCompletion += usage.completion_tokens;
  lastReply        = response.choices[0].message.content ?? '[tool_call]';

  const costUsd =
    (totalPrompt     / 1_000_000) * PRICE_INPUT_PER_1M +
    (totalCompletion / 1_000_000) * PRICE_OUTPUT_PER_1M;

  return {
    scenario:         name,
    turns:            1,
    promptTokens:     totalPrompt,
    completionTokens: totalCompletion,
    totalTokens:      totalPrompt + totalCompletion,
    costEstimateUsd:  costUsd,
    reply:            lastReply.slice(0, 120),
  };
}

async function runMultiTurn(
  name: string,
  turns: Array<{ user: string; assistantOrTool?: string }>,
  withTools = true,
): Promise<TestResult> {
  let totalPrompt     = 0;
  let totalCompletion = 0;
  let lastReply       = '';

  const history: Msg[] = [{ role: 'system', content: systemWithDate }];

  for (const turn of turns) {
    history.push({ role: 'user', content: turn.user });

    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: history,
      ...(withTools ? { tools, tool_choice: 'auto' } : {}),
    };

    const response = await client.chat.completions.create(params);
    const usage    = response.usage!;
    totalPrompt     += usage.prompt_tokens;
    totalCompletion += usage.completion_tokens;

    const choice = response.choices[0];
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      const tc = choice.message.tool_calls[0];
      history.push(choice.message as Msg);
      // Симулируем ответ инструмента
      const fakeResult = turn.assistantOrTool ?? JSON.stringify({ doctors: [{ id: 1, name: 'Иванова А.П.', speciality: 'Терапевт', slot: { date: today, time: '10:00' } }] });
      history.push({ role: 'tool', tool_call_id: tc.id, content: fakeResult });
      lastReply = `[tool_call: ${tc.function.name}]`;
    } else {
      const content = choice.message.content ?? '';
      history.push({ role: 'assistant', content });
      lastReply = content;
    }
  }

  const costUsd =
    (totalPrompt     / 1_000_000) * PRICE_INPUT_PER_1M +
    (totalCompletion / 1_000_000) * PRICE_OUTPUT_PER_1M;

  return {
    scenario:         name,
    turns:            turns.length,
    promptTokens:     totalPrompt,
    completionTokens: totalCompletion,
    totalTokens:      totalPrompt + totalCompletion,
    costEstimateUsd:  costUsd,
    reply:            lastReply.slice(0, 120),
  };
}

function printTable(results: TestResult[]) {
  const cols = {
    scenario:    30,
    turns:        6,
    prompt:      10,
    completion:  12,
    total:        8,
    cost:        14,
  };

  const hdr =
    'Сценарий'.padEnd(cols.scenario) +
    'Ходов'.padStart(cols.turns) +
    'Prompt'.padStart(cols.prompt) +
    'Completion'.padStart(cols.completion) +
    'Total'.padStart(cols.total) +
    'Цена ($)'.padStart(cols.cost);

  console.log('\n' + hdr);
  console.log('─'.repeat(hdr.length));

  for (const r of results) {
    console.log(
      r.scenario.padEnd(cols.scenario) +
      String(r.turns).padStart(cols.turns) +
      String(r.promptTokens).padStart(cols.prompt) +
      String(r.completionTokens).padStart(cols.completion) +
      String(r.totalTokens).padStart(cols.total) +
      r.costEstimateUsd.toFixed(6).padStart(cols.cost),
    );
    console.log('  → ' + r.reply);
  }

  const totPrompt = results.reduce((s, r) => s + r.promptTokens, 0);
  const totComp   = results.reduce((s, r) => s + r.completionTokens, 0);
  const totCost   = results.reduce((s, r) => s + r.costEstimateUsd, 0);
  console.log('─'.repeat(hdr.length));
  console.log(
    'ИТОГО'.padEnd(cols.scenario) +
    ''.padStart(cols.turns) +
    String(totPrompt).padStart(cols.prompt) +
    String(totComp).padStart(cols.completion) +
    String(totPrompt + totComp).padStart(cols.total) +
    totCost.toFixed(6).padStart(cols.cost),
  );
  console.log(`\nПримечание: цены приблизительные — уточни на https://cloud.ru/ru/pricing`);
}

async function main() {
  console.log(`Модель: ${model}`);
  console.log(`Базовый URL: ${baseURL}`);
  console.log(`Размер системного промпта: ${systemWithDate.length} символов\n`);

  const results: TestResult[] = [];

  // ── 1. Короткий сценарий ──────────────────────────────────────────────────
  console.log('▶ Тест 1: короткий запрос (1 ход, без инструментов)...');
  results.push(await runScenario(
    '1. Короткий (без tools)',
    [
      { role: 'system', content: systemWithDate },
      { role: 'user',   content: 'Привет! Хочу записаться к терапевту' },
    ],
    false,
  ));

  // ── 2. Средний сценарий ───────────────────────────────────────────────────
  console.log('▶ Тест 2: средний (3 хода + поиск врачей)...');
  results.push(await runMultiTurn(
    '2. Средний (3 хода)',
    [
      { user: 'Хочу записаться к терапевту' },
      { user: 'На завтра утром' },
      { user: 'Да, подтверждаю запись' },
    ],
    true,
  ));

  // ── 3. Длинный сценарий ───────────────────────────────────────────────────
  console.log('▶ Тест 3: длинный (6 ходов, смена врача, подтверждение)...');
  results.push(await runMultiTurn(
    '3. Длинный (6 ходов)',
    [
      { user: 'Здравствуйте, хочу записаться' },
      { user: 'К кардиологу, если можно' },
      { user: 'На следующей неделе, лучше утром во вторник' },
      { user: 'А есть ли другой врач, попозже — часов в 11?' },
      { user: 'Хорошо, запишите меня к Ивановой в 10:00' },
      { user: 'Да, подтверждаю' },
    ],
    true,
  ));

  printTable(results);
}

main().catch((err) => {
  console.error('Ошибка:', err.message ?? err);
  process.exit(1);
});
