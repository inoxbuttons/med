"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matches = matches;
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const core_module_1 = require("../core/core.module");
const nlu_service_1 = require("../core/nlu/nlu.service");
const clinic_profile_service_1 = require("../core/profile/clinic-profile.service");
const llm_module_1 = require("../llm/llm.module");
let CliModule = class CliModule {
};
CliModule = __decorate([
    (0, common_1.Module)({ imports: [config_1.ConfigModule.forRoot({ isGlobal: true }), core_module_1.CoreModule, llm_module_1.LlmModule], providers: [nlu_service_1.NluService] })
], CliModule);
function matches(actual, expected) {
    if (expected === '*')
        return actual !== undefined && actual !== null && actual !== '';
    if (Array.isArray(expected)) {
        return Array.isArray(actual) && expected.every((e, i) => matches(actual[i], e));
    }
    if (expected && typeof expected === 'object') {
        if (!actual || typeof actual !== 'object')
            return false;
        return Object.entries(expected).every(([k, v]) => matches(actual[k], v));
    }
    return actual === expected;
}
async function main() {
    const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
    const net = Number(arg('net') ?? 2);
    const provider = (arg('provider') ?? 'qwen3');
    const only = Number(arg('only') ?? 0);
    const app = await core_1.NestFactory.createApplicationContext(CliModule, { logger: ['warn', 'error'] });
    try {
        const { cases } = yaml.load(fs.readFileSync(path.join((0, clinic_profile_service_1.clinicsRoot)(), 'core', 'nlu-cases.yaml'), 'utf-8'));
        const list = only ? cases.slice(0, only) : cases;
        const nlu = app.get(nlu_service_1.NluService);
        let ok = 0, prompt = 0, completion = 0, llmCalls = 0;
        const started = Date.now();
        for (const c of list) {
            const res = await nlu.parse(c.text, {
                clinicNetId: net, mis: 'local', provider, model: arg('model'),
                expectation: c.expectation ?? { kind: 'none' }, now: new Date(2026, 10, 18),
            });
            const pass = matches(res.frame, c.expect);
            ok += +pass;
            if (res.source !== 'rules')
                llmCalls++;
            prompt += res.usage?.promptTokens ?? 0;
            completion += res.usage?.completionTokens ?? 0;
            console.log(`${pass ? 'OK  ' : 'FAIL'} [${res.source}] «${c.text}»${pass ? '' : `\n      ожидалось ${JSON.stringify(c.expect)}\n      получено  ${JSON.stringify(res.frame)}`}`);
        }
        console.log(`\n${provider}: ${ok}/${list.length} верно; вызовов модели ${llmCalls}; токены: вход ${prompt} (≈${Math.round(prompt / Math.max(1, llmCalls))}/вызов), выход ${completion}; ${((Date.now() - started) / 1000).toFixed(1)} с`);
    }
    finally {
        await app.close();
    }
}
if (require.main === module) {
    main().catch((err) => {
        common_1.Logger.error(String(err));
        process.exit(1);
    });
}
//# sourceMappingURL=nlu-eval.js.map