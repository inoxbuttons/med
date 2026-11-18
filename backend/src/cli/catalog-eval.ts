/**
 * Оценка поиска по золотому набору сети (src/clinics/nets/<slug>/golden-search.yaml).
 *   node dist/cli/catalog-eval.js --net=2 [--vector] [--verbose]
 * Без --vector модель не вызывается. С --vector — один эмбеддинг на запрос (платно).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { CatalogKind } from '../core/catalog/catalog-indexer.service';
import { CatalogModule } from '../core/catalog/catalog.module';
import { CatalogSearch, decide } from '../core/catalog/catalog-search.service';
import { CoreModule } from '../core/core.module';
import { ClinicProfileService, clinicsRoot } from '../core/profile/clinic-profile.service';
import { DatabaseModule } from '../database';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, CoreModule, CatalogModule] })
class CliModule {}

interface GoldenCase {
  q: string;
  kind: CatalogKind;
  tag: string;
  expect: string[];
}

async function main() {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}`));
  const net = Number(arg('net')?.split('=')[1]);
  if (!net) throw new Error('Укажите --net=<clinicNetId>');
  const useVector = !!arg('vector');
  const verbose = !!arg('verbose');
  process.env.CATALOG_REINDEX_ON_BOOT = 'false';

  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['warn', 'error'] });
  try {
    const slug = app.get(ClinicProfileService).forNet(net).slug;
    const file = path.join(clinicsRoot(), 'nets', slug, 'golden-search.yaml');
    const { cases } = yaml.load(fs.readFileSync(file, 'utf-8')) as { cases: GoldenCase[] };
    const search = app.get(CatalogSearch);

    const byTag = new Map<string, { n: number; top1: number; top5: number }>();
    const decisions = { single: 0, choice: 0, none: 0, wrongSingle: 0 };
    const misses: string[] = [];
    for (const c of cases) {
      const hits = await search.search(net, c.q, { kinds: [c.kind], limit: 5, noVector: !useVector });
      const re = c.expect.map((e) => new RegExp(e, 'i'));
      const ok = (title: string) => re.some((r) => r.test(title));
      const top1 = hits.length > 0 && ok(hits[0].title);
      const top5 = hits.some((h) => ok(h.title));
      const d = decide(c.q, hits);
      decisions[d.kind]++;
      if (d.kind === 'single' && !ok(d.hit.title)) decisions.wrongSingle++;

      const t = byTag.get(c.tag) ?? { n: 0, top1: 0, top5: 0 };
      t.n++; t.top1 += +top1; t.top5 += +top5;
      byTag.set(c.tag, t);
      if (!top5 || verbose) {
        misses.push(`${top5 ? (top1 ? '  ok ' : '  ~5 ') : 'MISS '}[${c.tag}] «${c.q}» → ${hits.slice(0, 3).map((h) => `${h.title.slice(0, 50)} (${h.coverage.toFixed(2)})`).join(' | ') || '—'}`);
      }
    }

    const total = [...byTag.values()].reduce((a, t) => ({ n: a.n + t.n, top1: a.top1 + t.top1, top5: a.top5 + t.top5 }), { n: 0, top1: 0, top5: 0 });
    const pct = (a: number, b: number) => `${Math.round((100 * a) / b)}%`;
    console.log(`\nСеть ${net} (${slug}), режим: ${useVector ? 'текст + триграммы + векторы' : 'текст + триграммы'}`);
    for (const [tag, t] of byTag) console.log(`  ${tag.padEnd(11)} n=${String(t.n).padStart(2)}  top1 ${pct(t.top1, t.n).padStart(4)}  top5 ${pct(t.top5, t.n).padStart(4)}`);
    console.log(`  ${'ИТОГО'.padEnd(11)} n=${String(total.n).padStart(2)}  top1 ${pct(total.top1, total.n).padStart(4)}  top5 ${pct(total.top5, total.n).padStart(4)}`);
    console.log(`  решения: single ${decisions.single} (из них неверных ${decisions.wrongSingle}), choice ${decisions.choice}, none ${decisions.none}`);
    if (misses.length) console.log('\n' + misses.join('\n'));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  Logger.error(String(err));
  process.exit(1);
});
