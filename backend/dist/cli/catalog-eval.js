"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const catalog_module_1 = require("../core/catalog/catalog.module");
const catalog_search_service_1 = require("../core/catalog/catalog-search.service");
const core_module_1 = require("../core/core.module");
const clinic_profile_service_1 = require("../core/profile/clinic-profile.service");
const database_1 = require("../database");
let CliModule = class CliModule {
};
CliModule = __decorate([
    (0, common_1.Module)({ imports: [config_1.ConfigModule.forRoot({ isGlobal: true }), database_1.DatabaseModule, core_module_1.CoreModule, catalog_module_1.CatalogModule] })
], CliModule);
async function main() {
    const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}`));
    const net = Number(arg('net')?.split('=')[1]);
    if (!net)
        throw new Error('Укажите --net=<clinicNetId>');
    const useVector = !!arg('vector');
    const verbose = !!arg('verbose');
    process.env.CATALOG_REINDEX_ON_BOOT = 'false';
    const app = await core_1.NestFactory.createApplicationContext(CliModule, { logger: ['warn', 'error'] });
    try {
        const slug = app.get(clinic_profile_service_1.ClinicProfileService).forNet(net).slug;
        const file = path.join((0, clinic_profile_service_1.clinicsRoot)(), 'nets', slug, 'golden-search.yaml');
        const { cases } = yaml.load(fs.readFileSync(file, 'utf-8'));
        const search = app.get(catalog_search_service_1.CatalogSearch);
        const byTag = new Map();
        const decisions = { single: 0, choice: 0, none: 0, wrongSingle: 0 };
        const misses = [];
        for (const c of cases) {
            const hits = await search.search(net, c.q, { kinds: [c.kind], limit: 5, noVector: !useVector });
            const re = c.expect.map((e) => new RegExp(e, 'i'));
            const ok = (title) => re.some((r) => r.test(title));
            const top1 = hits.length > 0 && ok(hits[0].title);
            const top5 = hits.some((h) => ok(h.title));
            const d = (0, catalog_search_service_1.decide)(c.q, hits);
            decisions[d.kind]++;
            if (d.kind === 'single' && !ok(d.hit.title))
                decisions.wrongSingle++;
            const t = byTag.get(c.tag) ?? { n: 0, top1: 0, top5: 0 };
            t.n++;
            t.top1 += +top1;
            t.top5 += +top5;
            byTag.set(c.tag, t);
            if (!top5 || verbose) {
                misses.push(`${top5 ? (top1 ? '  ok ' : '  ~5 ') : 'MISS '}[${c.tag}] «${c.q}» → ${hits.slice(0, 3).map((h) => `${h.title.slice(0, 50)} (${h.coverage.toFixed(2)})`).join(' | ') || '—'}`);
            }
        }
        const total = [...byTag.values()].reduce((a, t) => ({ n: a.n + t.n, top1: a.top1 + t.top1, top5: a.top5 + t.top5 }), { n: 0, top1: 0, top5: 0 });
        const pct = (a, b) => `${Math.round((100 * a) / b)}%`;
        console.log(`\nСеть ${net} (${slug}), режим: ${useVector ? 'текст + триграммы + векторы' : 'текст + триграммы'}`);
        for (const [tag, t] of byTag)
            console.log(`  ${tag.padEnd(11)} n=${String(t.n).padStart(2)}  top1 ${pct(t.top1, t.n).padStart(4)}  top5 ${pct(t.top5, t.n).padStart(4)}`);
        console.log(`  ${'ИТОГО'.padEnd(11)} n=${String(total.n).padStart(2)}  top1 ${pct(total.top1, total.n).padStart(4)}  top5 ${pct(total.top5, total.n).padStart(4)}`);
        console.log(`  решения: single ${decisions.single} (из них неверных ${decisions.wrongSingle}), choice ${decisions.choice}, none ${decisions.none}`);
        if (misses.length)
            console.log('\n' + misses.join('\n'));
    }
    finally {
        await app.close();
    }
}
main().catch((err) => {
    common_1.Logger.error(String(err));
    process.exit(1);
});
//# sourceMappingURL=catalog-eval.js.map