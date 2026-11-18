"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AnswerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnswerService = void 0;
const common_1 = require("@nestjs/common");
const catalog_search_service_1 = require("../catalog/catalog-search.service");
const llm_port_1 = require("../ports/llm.port");
const prompt_builder_service_1 = require("../prompts/prompt-builder.service");
const AGENT_TOOLS = [
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
let AnswerService = AnswerService_1 = class AnswerService {
    constructor(llm, prompts, search) {
        this.llm = llm;
        this.prompts = prompts;
        this.search = search;
        this.logger = new common_1.Logger(AnswerService_1.name);
    }
    async answer(question, facts, ctx) {
        const p = this.prompts.build('answer', { clinicNetId: ctx.clinicNetId, mis: ctx.mis });
        const messages = [
            { role: 'system', content: p.text },
            ...ctx.recent.slice(-4),
            { role: 'user', content: facts ? `Данные: ${facts}\n\nВопрос пациента: ${question}` : question },
        ];
        const res = await this.llm.complete({ provider: ctx.provider, model: ctx.model, messages, forceText: true, thinking: false });
        return { text: res.type === 'text' ? res.content.trim() : '', usage: res.usage ? [res.usage] : [], promptHash: p.hash, task: 'answer' };
    }
    async symptoms(complaint, speciality, ctx) {
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
    async agent(question, catalog, ctx) {
        const p = this.prompts.build('agent', { clinicNetId: ctx.clinicNetId, mis: ctx.mis });
        const messages = [{ role: 'system', content: p.text }, ...ctx.recent.slice(-4), { role: 'user', content: question }];
        const usage = [];
        for (let i = 0; i <= MAX_AGENT_CALLS; i++) {
            const last = i === MAX_AGENT_CALLS;
            const res = await this.llm.complete({ provider: ctx.provider, model: ctx.model, messages, tools: AGENT_TOOLS, forceText: last, thinking: false });
            if (res.usage)
                usage.push(res.usage);
            if (res.type === 'text')
                return { text: res.content.trim(), usage, promptHash: p.hash, task: 'agent' };
            const result = await this.runTool(res.toolName, res.toolArgs, catalog, ctx.clinicNetId);
            messages.push({ role: 'assistant', content: '', function_call: { name: res.toolName, arguments: JSON.stringify(res.toolArgs) } });
            messages.push({ role: 'function', name: res.toolName, content: JSON.stringify(result) });
        }
        return { text: '', usage, promptHash: p.hash, task: 'agent' };
    }
    async runTool(name, args, catalog, clinicNetId) {
        try {
            if (name === 'list_clinics') {
                return (await catalog.clinics()).map((c) => ({ name: c.name, address: c.address, phone: c.phone }));
            }
            if (name === 'search_catalog') {
                const kind = ['service', 'speciality', 'doctor'].includes(args.kind) ? args.kind : 'service';
                const hits = await this.search.search(clinicNetId, String(args.query ?? ''), { kinds: [kind], limit: 5 });
                return hits.map((h) => ({
                    name: h.title,
                    ...(kind === 'service' ? { selfBooking: h.meta.selfBooking, prices: (h.meta.clinics ?? []).map((c) => `${c.name}: ${c.price ?? '—'}`) } : {}),
                    ...(kind === 'doctor' ? { speciality: h.meta.speciality, clinics: (h.meta.clinics ?? []).map((c) => c.name) } : {}),
                }));
            }
        }
        catch (err) {
            this.logger.warn(`agent tool ${name}: ${String(err)}`);
        }
        return { error: 'нет данных' };
    }
};
exports.AnswerService = AnswerService;
exports.AnswerService = AnswerService = AnswerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(llm_port_1.LLM_PORT)),
    __metadata("design:paramtypes", [Object, prompt_builder_service_1.PromptBuilder,
        catalog_search_service_1.CatalogSearch])
], AnswerService);
//# sourceMappingURL=answer.service.js.map