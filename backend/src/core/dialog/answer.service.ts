import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChatMessage, LlmProvider } from '../../chat/chat.types';
import { LlmTool, LlmUsage } from '../../llm/llm.types';
import { CatalogSearch } from '../catalog/catalog-search.service';
import { CatalogSourcePort, MisKind } from '../ports';
import { LLM_PORT, LlmPort } from '../ports/llm.port';
import { PromptBuilder, PromptTask } from '../prompts/prompt-builder.service';

export interface AnswerContext {
  clinicNetId: number;
  mis: MisKind;
  provider: LlmProvider;
  model?: string;
  /** Последние реплики (без служебных данных). */
  recent: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AnswerResult {
  text: string;
  usage: LlmUsage[];
  promptHash: string;
  task: PromptTask;
}

const AGENT_TOOLS: LlmTool[] = [
  {
    name: 'search_catalog',
    description: 'Поиск по каталогу клиники: услуги, специальности или врачи',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Что искать, 1–4 слова' },
        kind: { type: 'string', enum: ['service', 'speciality', 'doctor'] },
      },
      required: ['query', 'kind'],
    },
  },
  {
    name: 'list_clinics',
    description: 'Клиники сети: названия, адреса, телефоны',
    parameters: { type: 'object', properties: {} },
  },
];

const MAX_AGENT_CALLS = 2;

/**
 * Свободные ответы модели — там, где шаблона недостаточно:
 *  answer   — вопрос с готовыми данными («Данные: …»);
 *  symptoms — текст про жалобу (специальность и слоты подбирает код);
 *  agent    — запасной путь с читающими инструментами (поиск, клиники), не больше 2 вызовов.
 */
@Injectable()
export class AnswerService {
  private readonly logger = new Logger(AnswerService.name);

  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly prompts: PromptBuilder,
    private readonly search: CatalogSearch,
  ) {}

  async answer(question: string, facts: string, ctx: AnswerContext): Promise<AnswerResult> {
    const p = this.prompts.build('answer', { clinicNetId: ctx.clinicNetId, mis: ctx.mis });
    const messages: ChatMessage[] = [
      { role: 'system', content: p.text },
      ...ctx.recent.slice(-4),
      { role: 'user', content: facts ? `Данные: ${facts}\n\nВопрос пациента: ${question}` : question },
    ];
    const res = await this.llm.complete({ provider: ctx.provider, model: ctx.model, messages, forceText: true, thinking: false });
    return { text: res.type === 'text' ? res.content.trim() : '', usage: res.usage ? [res.usage] : [], promptHash: p.hash, task: 'answer' };
  }

  async symptoms(complaint: string, speciality: string, ctx: AnswerContext): Promise<AnswerResult> {
    const p = this.prompts.build('symptoms', { clinicNetId: ctx.clinicNetId, mis: ctx.mis }, { speciality });
    const res = await this.llm.complete({
      provider: ctx.provider,
      model: ctx.model,
      forceText: true,
      thinking: false,
      messages: [{ role: 'system', content: p.text }, { role: 'user', content: complaint }],
    });
    return { text: res.type === 'text' ? res.content.trim() : '', usage: res.usage ? [res.usage] : [], promptHash: p.hash, task: 'symptoms' };
  }

  async agent(question: string, catalog: CatalogSourcePort, ctx: AnswerContext): Promise<AnswerResult> {
    const p = this.prompts.build('agent', { clinicNetId: ctx.clinicNetId, mis: ctx.mis });
    const messages: ChatMessage[] = [{ role: 'system', content: p.text }, ...ctx.recent.slice(-4), { role: 'user', content: question }];
    const usage: LlmUsage[] = [];
    for (let i = 0; i <= MAX_AGENT_CALLS; i++) {
      const last = i === MAX_AGENT_CALLS;
      const res = await this.llm.complete({ provider: ctx.provider, model: ctx.model, messages, tools: AGENT_TOOLS, forceText: last, thinking: false });
      if (res.usage) usage.push(res.usage);
      if (res.type === 'text') return { text: res.content.trim(), usage, promptHash: p.hash, task: 'agent' };
      const result = await this.runTool(res.toolName, res.toolArgs, catalog, ctx.clinicNetId);
      messages.push({ role: 'assistant', content: '', function_call: { name: res.toolName, arguments: JSON.stringify(res.toolArgs) } });
      messages.push({ role: 'function', name: res.toolName, content: JSON.stringify(result) });
    }
    return { text: '', usage, promptHash: p.hash, task: 'agent' };
  }

  private async runTool(name: string, args: Record<string, any>, catalog: CatalogSourcePort, clinicNetId: number): Promise<unknown> {
    try {
      if (name === 'list_clinics') {
        return (await catalog.clinics()).map((c) => ({ name: c.name, address: c.address, phone: c.phone }));
      }
      if (name === 'search_catalog') {
        const kind = ['service', 'speciality', 'doctor'].includes(args.kind) ? args.kind : 'service';
        const hits = await this.search.search(clinicNetId, String(args.query ?? ''), { kinds: [kind], limit: 5 });
        // Только то, что нужно для ответа: без id и служебных полей.
        return hits.map((h) => ({
          name: h.title,
          ...(kind === 'service' ? { selfBooking: h.meta.selfBooking, prices: (h.meta.clinics ?? []).map((c: any) => `${c.name}: ${c.price ?? '—'}`) } : {}),
          ...(kind === 'doctor' ? { speciality: h.meta.speciality, clinics: (h.meta.clinics ?? []).map((c: any) => c.name) } : {}),
        }));
      }
    } catch (err) {
      this.logger.warn(`agent tool ${name}: ${String(err)}`);
    }
    return { error: 'нет данных' };
  }
}
