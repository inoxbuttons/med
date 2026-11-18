import { Inject, Injectable, Logger } from '@nestjs/common';
import { LlmProvider } from '../../chat/chat.types';
import { LlmUsage } from '../../llm/llm.types';
import { toDateStr } from '../../integrations/shared/date-utils';
import { LLM_PORT, LlmPort } from '../ports/llm.port';
import { MisKind } from '../ports';
import { PromptBuilder } from '../prompts/prompt-builder.service';
import { Frame, FRAME_JSON_SCHEMA, parseFrame } from './frame';
import { Expectation, parseByRules } from './rule-parser';

const WEEKDAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export interface NluContext {
  clinicNetId: number;
  mis: MisKind;
  provider: LlmProvider;
  model?: string;
  expectation: Expectation;
  /** Кратко: текущая цель и что уже известно («запись к врачу; специальность: невролог»). */
  stateSummary?: string;
  /** Последнее сообщение ассистента (обрезается). */
  lastAssistant?: string;
  /** 1–2 предыдущие реплики пациента. */
  recentUser?: string[];
  now?: Date;
}

export interface NluResult {
  frame: Frame;
  source: 'rules' | 'llm' | 'fallback';
  usage?: LlmUsage;
  promptHash?: string;
}

/**
 * Разбор реплики: сначала правила (без модели), затем один вызов модели по JSON-схеме.
 * При невалидном ответе — один повтор; затем goal=other (движок уйдёт в свободный ответ).
 */
@Injectable()
export class NluService {
  private readonly logger = new Logger(NluService.name);

  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly prompts: PromptBuilder,
  ) {}

  async parse(text: string, ctx: NluContext): Promise<NluResult> {
    const byRules = parseByRules(text, ctx.expectation);
    if (byRules) return { frame: byRules, source: 'rules' };

    const now = ctx.now ?? new Date();
    const prompt = this.prompts.build(
      'nlu',
      { clinicNetId: ctx.clinicNetId, mis: ctx.mis },
      { today: toDateStr(now), weekday: WEEKDAYS_RU[now.getDay()] },
    );
    const user = buildUserMessage(text, ctx);

    let usage: LlmUsage | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.llm.completeJson({
          provider: ctx.provider,
          model: ctx.model,
          schemaName: 'patient_frame',
          description: 'Разобранная реплика пациента',
          schema: FRAME_JSON_SCHEMA,
          messages: [
            { role: 'system', content: prompt.text },
            { role: 'user', content: user },
          ],
        });
        usage = sumUsage(usage, res.usage);
        const frame = parseFrame(res.data);
        if (frame) return { frame, source: 'llm', usage, promptHash: prompt.hash };
        this.logger.warn(`NLU: невалидный ответ (${attempt + 1}): ${res.raw.slice(0, 200)}`);
      } catch (err) {
        this.logger.warn(`NLU: ошибка вызова (${attempt + 1}): ${String(err)}`);
      }
    }
    return { frame: { goal: 'other', entities: {} }, source: 'fallback', usage, promptHash: prompt.hash };
  }
}

export function buildUserMessage(text: string, ctx: NluContext): string {
  const lines: string[] = [];
  if (ctx.stateSummary) lines.push(`Состояние диалога: ${ctx.stateSummary}`);
  const waits = describeExpectation(ctx.expectation);
  if (waits) lines.push(`Ассистент ждёт: ${waits}`);
  if (ctx.expectation.kind === 'choice') {
    lines.push('Варианты, показанные пациенту:');
    ctx.expectation.options.forEach((o, i) => lines.push(`${i + 1}. ${o.label}`));
  }
  if (ctx.lastAssistant) lines.push(`Ассистент: ${ctx.lastAssistant.slice(0, 300)}`);
  for (const u of (ctx.recentUser ?? []).slice(-2)) lines.push(`Пациент ранее: ${u.slice(0, 200)}`);
  lines.push(`Реплика пациента: ${text}`);
  return lines.join('\n');
}

function sumUsage(a: LlmUsage | undefined, b: LlmUsage | undefined): LlmUsage | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

function describeExpectation(e: NluContext['expectation']): string | null {
  switch (e.kind) {
    case 'confirm': return 'подтверждения (да/нет)';
    case 'yes_no': return e.field === 'hasReferral' ? 'ответа, есть ли направление (да/нет)' : 'ответа да/нет';
    case 'choice': return 'выбора варианта из списка';
    case 'visit_type': return 'типа приёма (первичный/повторный)';
    case 'date': return 'дня и времени';
    case 'patient_data': return 'ФИО, телефона и даты рождения пациента';
    default: return null;
  }
}
