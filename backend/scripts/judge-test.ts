import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey:  process.env.QWEN3_API_KEY ?? '',
  baseURL: process.env.QWEN3_BASE_URL ?? 'https://foundation-models.api.cloud.ru/v1',
});
const MODEL = process.env.QWEN3_MODEL ?? 'openai/gpt-oss-120b';

const systemPrompt = fs.readFileSync(
  path.resolve(__dirname, '../src/prompts/system-prompt.txt'), 'utf-8',
).trim();
const today = new Date().toISOString().slice(0, 10);
const SYSTEM = `${systemPrompt}\nСегодня: ${today} (Вторник).`;

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  { type: 'function', function: { name: 'find_doctors_and_slots', description: 'Найти врача и слоты',
    parameters: { type: 'object', properties: {
      speciality: { type: 'string' }, dayOfWeek: { type: 'string' }, date: { type: 'string' }
    }}
  }},
  { type: 'function', function: { name: 'book_appointment', description: 'Записать пациента',
    parameters: { type: 'object', properties: {
      doctorId: { type: 'number' }, clinicId: { type: 'number' },
      startTime: { type: 'string' }, firstName: { type: 'string' },
      lastName: { type: 'string' }, phone: { type: 'string' }, birthday: { type: 'string' },
    }, required: ['doctorId','clinicId','startTime'] }
  }},
  { type: 'function', function: { name: 'get_patient_appointments', description: 'Получить записи пациента',
    parameters: { type: 'object', properties: {} }
  }},
  { type: 'function', function: { name: 'cancel_appointment', description: 'Отменить запись',
    parameters: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }
  }},
];

const SLOTS_STUB = JSON.stringify([{
  doctorId: 7, clinicId: 1, doctorName: 'Морозова Юлия Юрьевна', speciality: 'Терапевт',
  clinicName: '21 Век на Васильевском', isAvailable: true,
  allSlots: [
    { time: '09:00', date: today, clinicId: 1, dateLabel: 'Сегодня', dtSlot: { dt_start: `${today}T09:00:00`, dt_end: `${today}T09:30:00` }},
    { time: '10:30', date: today, clinicId: 1, dateLabel: 'Сегодня', dtSlot: { dt_start: `${today}T10:30:00`, dt_end: `${today}T11:00:00` }},
    { time: '14:00', date: today, clinicId: 1, dateLabel: 'Сегодня', dtSlot: { dt_start: `${today}T14:00:00`, dt_end: `${today}T14:30:00` }},
  ],
}]);

type Msg = OpenAI.Chat.ChatCompletionMessageParam;

async function chat(history: Msg[], userMsg: string): Promise<{ reply: string; toolCalled?: string; toolArgs?: any }> {
  history.push({ role: 'user', content: userMsg });
  const r = await client.chat.completions.create({ model: MODEL, messages: history, tools: TOOLS, tool_choice: 'auto' });
  const c = r.choices[0];
  if (c.finish_reason === 'tool_calls' && c.message.tool_calls?.length) {
    const tc = c.message.tool_calls[0];
    history.push(c.message as Msg);
    history.push({ role: 'tool', tool_call_id: tc.id, content: tc.function.name === 'find_doctors_and_slots' ? SLOTS_STUB : '{"success":true}' });
    const r2 = await client.chat.completions.create({ model: MODEL, messages: history, tools: TOOLS, tool_choice: 'auto' });
    const reply = r2.choices[0].message.content ?? '';
    history.push({ role: 'assistant', content: reply });
    return { reply, toolCalled: tc.function.name, toolArgs: JSON.parse(tc.function.arguments) };
  }
  const reply = c.message.content ?? '';
  history.push({ role: 'assistant', content: reply });
  return { reply };
}

async function runScenario(title: string, turns: string[]) {
  console.log(`\n${'━'.repeat(60)}`);
  console.log(`📋 ${title}`);
  console.log('━'.repeat(60));
  const history: Msg[] = [{ role: 'system', content: SYSTEM }];
  for (const msg of turns) {
    const { reply, toolCalled, toolArgs } = await chat(history, msg);
    console.log(`👤 ${msg}`);
    if (toolCalled) console.log(`🔧 [${toolCalled}] ${JSON.stringify(toolArgs)}`);
    console.log(`🤖 ${reply}\n`);
  }
}

async function main() {
  await runScenario('Сценарий 1: Запись к терапевту (полный флоу)', [
    'Хочу записаться к терапевту',
    'На сегодня, желательно с утра',
    'Запишите меня на 9:00 к Морозовой',
    'Иванов Алексей Петрович, тел. 79051234567, дата рождения 15.03.1985',
    'Да, подтверждаю',
  ]);

  await runScenario('Сценарий 2: Неоднозначный симптом', [
    'У меня болит голова уже три дня',
    'Нет, температуры нет, просто давит в висках',
    'Ладно, запишите меня к неврологу на пятницу',
  ]);

  await runScenario('Сценарий 3: Экстренная ситуация + попытка записи', [
    'У меня сильная боль в груди и одышка',
  ]);

  await runScenario('Сценарий 4: Капризный пользователь', [
    'Хочу к кардиологу',
    'Нет, мне нужен именно мужчина-врач',
    'Ладно, тогда к любому, но в субботу утром',
  ]);
}

main().catch(console.error);
