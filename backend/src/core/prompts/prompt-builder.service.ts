import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { MisKind } from '../ports';
import { ClinicProfileService, clinicsRoot } from '../profile/clinic-profile.service';

/**
 * Задачи модели, у каждой свой промпт:
 *  legacy   — текущий движок с инструментами (бывший system-prompt.txt);
 *  nlu      — разбор реплики в JSON;
 *  answer   — свободный ответ (вопросы о клинике, непонятные реплики);
 *  symptoms — ответ на жалобу без диагнозов;
 *  agent    — запасной агент с читающими инструментами.
 */
export type PromptTask = 'legacy' | 'nlu' | 'answer' | 'symptoms' | 'agent';

export interface BuiltPrompt {
  text: string;
  /** Первые 12 символов sha1 итогового текста до подстановки переменных — версия промпта. */
  hash: string;
  /** Пути слоёв относительно clinics/ — для отладки. */
  layers: string[];
}

/**
 * Промпт = слои, склеенные через пустую строку:
 *   core/prompts/<task>.md               — ядро, общее для всех;
 *   core/prompts/mis/<mis>/<task>.md     — особенности МИС (необязательно);
 *   nets/<slug>/prompts/<task>.md        — слой сети (необязательно).
 * Переменные {{name}} подставляются из vars; неизвестная переменная — ошибка
 * (опечатка в промпте не должна молча уйти в модель).
 */
@Injectable()
export class PromptBuilder {
  private readonly logger = new Logger(PromptBuilder.name);
  private readonly cache = new Map<string, string | null>();

  constructor(
    private readonly profiles: ClinicProfileService,
    private readonly root: string = clinicsRoot(),
  ) {}

  build(
    task: PromptTask,
    target: { clinicNetId?: number | null; mis?: MisKind },
    vars: Record<string, string | number> = {},
    opts: { coreOverride?: string } = {},
  ): BuiltPrompt {
    const profile = this.profiles.forNet(target.clinicNetId);
    const candidates = [
      `core/prompts/${task}.md`,
      target.mis ? `core/prompts/mis/${target.mis}/${task}.md` : null,
      profile.slug !== 'default' ? `nets/${profile.slug}/prompts/${task}.md` : null,
    ].filter(Boolean) as string[];

    const layers: string[] = [];
    const parts: string[] = [];
    candidates.forEach((rel, i) => {
      const content = i === 0 && opts.coreOverride ? opts.coreOverride : this.read(rel);
      if (content === null) {
        if (i === 0) throw new Error(`Нет ядра промпта ${rel}`);
        return;
      }
      layers.push(i === 0 && opts.coreOverride ? 'env:CHAT_SYSTEM_PROMPT' : rel);
      if (content.trim()) parts.push(content.trim());
    });

    const template = parts.join('\n\n');
    const hash = crypto.createHash('sha1').update(template).digest('hex').slice(0, 12);
    const allVars: Record<string, string | number> = { clinicName: profile.displayName, ...vars };
    const text = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, name: string) => {
      if (!(name in allVars)) throw new Error(`Промпт ${task}: переменная {{${name}}} не передана`);
      return String(allVars[name]);
    });
    return { text, hash, layers };
  }

  /** Сбросить кеш файлов (после правки промптов без перезапуска — в разработке). */
  clearCache(): void {
    this.cache.clear();
  }

  private read(rel: string): string | null {
    if (this.cache.has(rel)) return this.cache.get(rel)!;
    const file = path.join(this.root, rel);
    const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
    this.cache.set(rel, content);
    return content;
  }
}
