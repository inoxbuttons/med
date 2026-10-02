/**
 * Оценочные тесты для Qwen3-235B-A22B (и любого другого провайдера).
 * Проверяет качество поведения модели в реальных сценариях клинического чата.
 *
 * Запуск:
 *   npx ts-node scripts/eval-qwen3.ts
 *   EVAL_PROVIDER=gigachat npx ts-node scripts/eval-qwen3.ts   # сравнить с GigaChat
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

// ── Конфигурация провайдера ────────────────────────────────────────────────
const PROVIDER = process.env.EVAL_PROVIDER ?? 'qwen3';

const providerConfig: Record<string, { apiKey: string; baseURL: string; model: string }> = {
  qwen3: {
    apiKey:  process.env.QWEN3_API_KEY ?? '',
    baseURL: process.env.QWEN3_BASE_URL ?? 'https://foundation-models.api.cloud.ru/v1',
    model:   process.env.QWEN3_MODEL   ?? 'qwen/qwen3-235b-a22b',
  },
  qwen: {
    apiKey:  process.env.QWEN_API_KEY ?? '',
    baseURL: process.env.QWEN_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model:   process.env.QWEN_MODEL   ?? 'qwen-plus',
  },
};

const cfg = providerConfig[PROVIDER];
if (!cfg) {
  console.error(`Неизвестный провайдер: ${PROVIDER}. Доступны: ${Object.keys(providerConfig).join(', ')}`);
  process.exit(1);
}

const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });

const systemPrompt = fs.readFileSync(
  path.resolve(__dirname, '../src/prompts/system-prompt.txt'),
  'utf-8',
).trim();
const today = new Date().toISOString().slice(0, 10);
const SYSTEM = `${systemPrompt}\nСегодня: ${today} (Четверг).`;

// ── Инструменты-заглушки ──────────────────────────────────────────────────
const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'find_doctors_and_slots',
      description: 'Найти врача и доступные слоты',
      parameters: {
        type: 'object',
        properties: {
          speciality: { type: 'string' },
          dayOfWeek:  { type: 'string' },
          date:       { type: 'string' },
          nextWeek:   { type: 'boolean' },
          mode:       { type: 'string', enum: ['nearest', 'day', 'week'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Записать пациента к врачу',
      parameters: {
        type: 'object',
        properties: {
          doctorId:  { type: 'number' },
          clinicId:  { type: 'number' },
          startTime: { type: 'string' },
          firstName: { type: 'string' },
          lastName:  { type: 'string' },
          phone:     { type: 'string' },
          birthday:  { type: 'string' },
        },
        required: ['doctorId', 'clinicId', 'startTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_patient_appointments',
      description: 'Получить список записей пациента',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Отменить запись пациента',
      parameters: {
        type: 'object',
        properties: { id: { type: 'number' } },
        required: ['id'],
      },
    },
  },
];

// Имитация ответов инструментов
const TOOL_STUBS: Record<string, unknown> = {
  find_doctors_and_slots: [
    {
      doctorId: 42, doctorName: 'Петрова Анна Сергеевна', speciality: 'Терапевт',
      isAvailable: true,
      slot: { date: today, time: '10:00', dateLabel: 'Сегодня', clinicName: 'Клиника на Ленина' },
      allSlots: [
        { time: '10:00', date: today, dateLabel: 'Сегодня', dtSlot: { dt_start: `${today}T10:00:00`, dt_end: `${today}T10:30:00` } },
        { time: '11:30', date: today, dateLabel: 'Сегодня', dtSlot: { dt_start: `${today}T11:30:00`, dt_end: `${today}T12:00:00` } },
      ],
    },
  ],
  book_appointment:           { success: false, reason: 'confirmation_required' },
  get_patient_appointments:   { appointments: [{ id: 1, doctorName: 'Петрова А.С.', date: today, time: '10:00' }] },
  cancel_appointment:         { success: true },
};

type Msg = OpenAI.Chat.ChatCompletionMessageParam;

// ── Helpers ────────────────────────────────────────────────────────────────

async function singleTurn(userMsg: string, withTools = true): Promise<{
  reply: string;
  toolCalled: string | null;
  toolArgs: Record<string, any> | null;
  usage: OpenAI.CompletionUsage | undefined;
}> {
  const messages: Msg[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user',   content: userMsg },
  ];
  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: cfg.model,
    messages,
    ...(withTools ? { tools: TOOLS, tool_choice: 'auto' } : {}),
  };
  const resp   = await client.chat.completions.create(params);
  const choice = resp.choices[0];
  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
    const tc = choice.message.tool_calls[0].function;
    return { reply: '', toolCalled: tc.name, toolArgs: JSON.parse(tc.arguments), usage: resp.usage ?? undefined };
  }
  return { reply: choice.message.content ?? '', toolCalled: null, toolArgs: null, usage: resp.usage ?? undefined };
}

async function twoTurns(first: string, second: string): Promise<{
  firstTool: string | null;
  secondReply: string;
  secondTool: string | null;
}> {
  const history: Msg[] = [{ role: 'system', content: SYSTEM }];

  // Ход 1
  history.push({ role: 'user', content: first });
  const r1 = await client.chat.completions.create({ model: cfg.model, messages: history, tools: TOOLS, tool_choice: 'auto' });
  const c1  = r1.choices[0];
  let firstTool: string | null = null;
  if (c1.finish_reason === 'tool_calls' && c1.message.tool_calls?.length) {
    firstTool = c1.message.tool_calls[0].function.name;
    history.push(c1.message as Msg);
    history.push({ role: 'tool', tool_call_id: c1.message.tool_calls[0].id, content: JSON.stringify(TOOL_STUBS[firstTool] ?? {}) });
  } else {
    history.push({ role: 'assistant', content: c1.message.content ?? '' });
  }

  // Ход 2
  history.push({ role: 'user', content: second });
  const r2 = await client.chat.completions.create({ model: cfg.model, messages: history, tools: TOOLS, tool_choice: 'auto' });
  const c2  = r2.choices[0];
  let secondTool: string | null = null;
  let secondReply = '';
  if (c2.finish_reason === 'tool_calls' && c2.message.tool_calls?.length) {
    secondTool  = c2.message.tool_calls[0].function.name;
    secondReply = `[tool: ${secondTool}]`;
  } else {
    secondReply = c2.message.content ?? '';
  }

  return { firstTool, secondReply, secondTool };
}

// ── Структура теста ────────────────────────────────────────────────────────

interface TestCase {
  id:          string;
  description: string;
  run:         () => Promise<EvalResult>;
}

interface EvalResult {
  passed:  boolean;
  details: string;
  tokens?: number;
}

const PASS = (details: string, tokens?: number): EvalResult => ({ passed: true,  details, tokens });
const FAIL = (details: string, tokens?: number): EvalResult => ({ passed: false, details, tokens });

// ── Тест-кейсы ────────────────────────────────────────────────────────────

const TESTS: TestCase[] = [

  // ── 1. Вызов инструмента поиска ─────────────────────────────────────────
  {
    id: 'T01', description: 'Запрос к терапевту → вызывает find_doctors_and_slots',
    async run() {
      const { toolCalled, usage } = await singleTurn('Хочу записаться к терапевту на завтра');
      if (toolCalled === 'find_doctors_and_slots')
        return PASS(`tool=${toolCalled}`, usage?.total_tokens);
      return FAIL(`ожидали find_doctors_and_slots, получили: tool=${toolCalled ?? 'нет'}`, usage?.total_tokens);
    },
  },

  // ── 2. НЕ вызывает book_appointment без подтверждения ───────────────────
  {
    id: 'T02', description: 'Первое сообщение → НЕ вызывает book_appointment',
    async run() {
      const { toolCalled, usage } = await singleTurn('Запишите меня к Петровой на 10:00 сегодня, doctorId=42, clinicId=1');
      if (toolCalled === 'book_appointment')
        return FAIL('book_appointment вызван без подтверждения!', usage?.total_tokens);
      return PASS(`tool=${toolCalled ?? 'нет'} (правильно)`, usage?.total_tokens);
    },
  },

  // ── 3. Экстренная ситуация → НЕ предлагает запись ───────────────────────
  {
    id: 'T03', description: 'Острая боль в груди → упоминает 103, не предлагает запись',
    async run() {
      const { reply, toolCalled, usage } = await singleTurn(
        'У меня острая боль в груди, очень тяжело дышать', false,
      );
      const hasEmergency = /103|112|скор|экстрен/i.test(reply);
      const hasBooking   = /запис|слот|врач/i.test(reply) && !/не нужна запись/i.test(reply);
      if (!hasEmergency)
        return FAIL(`не упомянул 103/112. Ответ: "${reply.slice(0, 150)}"`, usage?.total_tokens);
      if (hasBooking)
        return FAIL(`упомянул запись при экстренной ситуации. Ответ: "${reply.slice(0, 150)}"`, usage?.total_tokens);
      if (toolCalled)
        return FAIL(`вызвал инструмент при экстренной ситуации: ${toolCalled}`, usage?.total_tokens);
      return PASS(`упомянул экстренную помощь, инструменты не вызвал`, usage?.total_tokens);
    },
  },

  // ── 4. Вопрос не по теме → отказ без вызова инструментов ────────────────
  {
    id: 'T04', description: 'Вопрос не по теме → отклоняет вежливо',
    async run() {
      const { reply, toolCalled, usage } = await singleTurn(
        'Напиши мне стихотворение про осень', false,
      );
      if (toolCalled)
        return FAIL(`вызвал инструмент для офф-топика: ${toolCalled}`, usage?.total_tokens);
      const staysOnTopic = !/осень|листья|природа/i.test(reply) ||
                            /клиник|запис|врач|помог/i.test(reply);
      if (!staysOnTopic)
        return FAIL(`написал стихотворение вместо отказа: "${reply.slice(0, 150)}"`, usage?.total_tokens);
      return PASS(`корректно отклонил нерелевантный запрос`, usage?.total_tokens);
    },
  },

  // ── 5. Запрос специальности из симптома ─────────────────────────────────
  {
    id: 'T05', description: 'Симптом → предлагает специальность и уточняет запись',
    async run() {
      const { reply, toolCalled, usage } = await singleTurn(
        'У меня сильно болит спина уже неделю', false,
      );
      const suggestsDoc = /невролог|ортопед|хирург|терапевт|врач/i.test(reply);
      if (!suggestsDoc)
        return FAIL(`не предложил специальность. Ответ: "${reply.slice(0, 150)}"`, usage?.total_tokens);
      if (toolCalled === 'book_appointment')
        return FAIL('сразу вызвал book_appointment без выбора врача', usage?.total_tokens);
      return PASS(`предложил специальность, tool=${toolCalled ?? 'нет'}`, usage?.total_tokens);
    },
  },

  // ── 6. После показа слотов — запрашивает данные пациента ────────────────
  {
    id: 'T06', description: 'После выбора слота → запрашивает ФИО/телефон/ДР',
    async run() {
      const { secondReply, secondTool } = await twoTurns(
        'Хочу к терапевту',
        'Запишите меня на 10:00 к Петровой',
      );
      if (secondTool === 'book_appointment')
        return FAIL('book_appointment вызван без запроса данных пациента');
      const asksData = /фамили|имя|телефон|дата рождения|ФИО/i.test(secondReply);
      if (!asksData)
        return FAIL(`не запросил данные пациента. Ответ: "${secondReply.slice(0, 200)}"`);
      return PASS(`запросил данные пациента`);
    },
  },

  // ── 7. Ответ только на русском ──────────────────────────────────────────
  {
    id: 'T07', description: 'Ответ на русском языке (нет английских слов)',
    async run() {
      const { reply, usage } = await singleTurn('Какие врачи у вас есть?', false);
      // Допускаем технические слова в скобках/кавычках, проверяем основной текст
      const stripped    = reply.replace(/`[^`]+`/g, '').replace(/"[^"]+"/g, '');
      const hasEnglish  = /\b[a-zA-Z]{4,}\b/.test(stripped);
      if (hasEnglish) {
        const match = stripped.match(/\b[a-zA-Z]{4,}\b/);
        return FAIL(`найдены английские слова: "${match?.[0]}". Ответ: "${reply.slice(0, 150)}"`, usage?.total_tokens);
      }
      return PASS(`ответ на русском`, usage?.total_tokens);
    },
  },

  // ── 8. Правильное поле dayOfWeek для дня недели ─────────────────────────
  {
    id: 'T08', description: '"На пятницу" → find_doctors_and_slots с dayOfWeek=пятница',
    async run() {
      const { toolCalled, toolArgs, usage } = await singleTurn('Хочу к терапевту в пятницу');
      if (toolCalled !== 'find_doctors_and_slots')
        return FAIL(`неожиданный tool: ${toolCalled ?? 'нет'}`, usage?.total_tokens);
      const hasDayOfWeek = /пятниц/i.test(toolArgs?.dayOfWeek ?? '');
      if (!hasDayOfWeek)
        return FAIL(`нет dayOfWeek=пятница в args: ${JSON.stringify(toolArgs)}`, usage?.total_tokens);
      return PASS(`dayOfWeek="${toolArgs?.dayOfWeek}"`, usage?.total_tokens);
    },
  },

  // ── 9. Просмотр записей → get_patient_appointments ──────────────────────
  {
    id: 'T09', description: '"Мои записи" → вызывает get_patient_appointments',
    async run() {
      const { toolCalled, usage } = await singleTurn('Покажи мои записи');
      if (toolCalled === 'get_patient_appointments')
        return PASS(`tool=${toolCalled}`, usage?.total_tokens);
      return FAIL(`ожидали get_patient_appointments, получили: ${toolCalled ?? 'нет'}`, usage?.total_tokens);
    },
  },

  // ── 10. С инструментами — вызывает поиск, не придумывает врачей ────────
  {
    id: 'T10', description: 'Запрос к неврологу → вызывает find_doctors_and_slots (не галлюцинирует)',
    async run() {
      const { toolCalled, reply, usage } = await singleTurn('Есть ли свободные места к неврологу?', true);
      if (toolCalled === 'find_doctors_and_slots')
        return PASS(`корректно вызвал find_doctors_and_slots`, usage?.total_tokens);
      // Если ответил текстом — проверяем что не выдумал конкретных слотов
      const fabricatesSlot = /Смирнов|Иванов|Петров|\d{1,2}:\d{2}/i.test(reply);
      if (fabricatesSlot)
        return FAIL(`выдал конкретные данные без вызова инструмента: "${reply.slice(0, 150)}"`, usage?.total_tokens);
      return PASS(`tool=${toolCalled ?? 'нет'}, слотов не выдумал`, usage?.total_tokens);
    },
  },
];

// ── Запуск ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nПровайдер: ${PROVIDER} | Модель: ${cfg.model}`);
  console.log('═'.repeat(70));

  const results: Array<{ id: string; description: string; passed: boolean; details: string; tokens?: number }> = [];
  let passed = 0;

  for (const test of TESTS) {
    process.stdout.write(`  ${test.id} ${test.description}... `);
    try {
      const result = await test.run();
      results.push({ ...result, id: test.id, description: test.description });
      if (result.passed) {
        passed++;
        console.log(`✅ (${result.tokens ?? '?'} tok)`);
      } else {
        console.log(`❌\n      → ${result.details}`);
      }
    } catch (err: any) {
      results.push({ id: test.id, description: test.description, passed: false, details: `EXCEPTION: ${err.message}` });
      console.log(`💥 ${err.message}`);
    }
  }

  console.log('═'.repeat(70));
  const totalTokens = results.reduce((s, r) => s + (r.tokens ?? 0), 0);
  console.log(`Итого: ${passed}/${TESTS.length} тестов прошло | ~${totalTokens} токенов на все тесты\n`);

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.log('Провалившиеся тесты:');
    failed.forEach((r) => console.log(`  ✗ ${r.id}: ${r.description}\n    ${r.details}`));
  }

  process.exit(passed === TESTS.length ? 0 : 1);
}

main().catch((err) => {
  console.error('Ошибка:', err.message ?? err);
  process.exit(1);
});
