/**
 * Оценка разбора реплик (src/clinics/core/nlu-cases.yaml). ВЫЗЫВАЕТ МОДЕЛЬ — запуск по согласованию.
 *   node dist/cli/nlu-eval.js --net=2 --provider=qwen3|gigachat [--model=...] [--only=5]
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { LlmProvider } from '../chat/chat.types';
import { CoreModule } from '../core/core.module';
import { NluService } from '../core/nlu/nlu.service';
import { Expectation } from '../core/nlu/rule-parser';
import { clinicsRoot } from '../core/profile/clinic-profile.service';
import { LlmModule } from '../llm/llm.module';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), CoreModule, LlmModule], providers: [NluService] })
class CliModule {}

interface NluCase {
  text: string;
  expectation?: Expectation;
  expect: Record<string, unknown>;
}

/** Частичное совпадение: «*» — поле заполнено; массивы — поэлементно. */
export function matches(actual: unknown, expected: unknown): boolean {
  if (expected === '*') return actual !== undefined && actual !== null && actual !== '';
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && expected.every((e, i) => matches(actual[i], e));
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') return false;
    return Object.entries(expected).every(([k, v]) => matches((actual as Record<string, unknown>)[k], v));
  }
  return actual === expected;
}

async function main() {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const net = Number(arg('net') ?? 2);
  const provider = (arg('provider') ?? 'qwen3') as LlmProvider;
  const only = Number(arg('only') ?? 0);
  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['warn', 'error'] });
  try {
    const { cases } = yaml.load(fs.readFileSync(path.join(clinicsRoot(), 'core', 'nlu-cases.yaml'), 'utf-8')) as { cases: NluCase[] };
    const list = only ? cases.slice(0, only) : cases;
    const nlu = app.get(NluService);
    let ok = 0, prompt = 0, completion = 0, llmCalls = 0;
    const started = Date.now();
    for (const c of list) {
      const res = await nlu.parse(c.text, {
        clinicNetId: net, mis: 'local', provider, model: arg('model'),
        expectation: c.expectation ?? { kind: 'none' }, now: new Date(2026, 10, 18),
      });
      const pass = matches(res.frame, c.expect);
      ok += +pass;
      if (res.source !== 'rules') llmCalls++;
      prompt += res.usage?.promptTokens ?? 0;
      completion += res.usage?.completionTokens ?? 0;
      console.log(`${pass ? 'OK  ' : 'FAIL'} [${res.source}] «${c.text}»${pass ? '' : `\n      ожидалось ${JSON.stringify(c.expect)}\n      получено  ${JSON.stringify(res.frame)}`}`);
    }
    console.log(`\n${provider}: ${ok}/${list.length} верно; вызовов модели ${llmCalls}; токены: вход ${prompt} (≈${Math.round(prompt / Math.max(1, llmCalls))}/вызов), выход ${completion}; ${((Date.now() - started) / 1000).toFixed(1)} с`);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    Logger.error(String(err));
    process.exit(1);
  });
}
