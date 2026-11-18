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
var NluService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NluService = void 0;
exports.buildUserMessage = buildUserMessage;
const common_1 = require("@nestjs/common");
const date_utils_1 = require("../../integrations/shared/date-utils");
const llm_port_1 = require("../ports/llm.port");
const prompt_builder_service_1 = require("../prompts/prompt-builder.service");
const frame_1 = require("./frame");
const rule_parser_1 = require("./rule-parser");
const WEEKDAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
let NluService = NluService_1 = class NluService {
    constructor(llm, prompts) {
        this.llm = llm;
        this.prompts = prompts;
        this.logger = new common_1.Logger(NluService_1.name);
    }
    async parse(text, ctx) {
        const byRules = (0, rule_parser_1.parseByRules)(text, ctx.expectation);
        if (byRules)
            return { frame: byRules, source: 'rules' };
        const now = ctx.now ?? new Date();
        const prompt = this.prompts.build('nlu', { clinicNetId: ctx.clinicNetId, mis: ctx.mis }, { today: (0, date_utils_1.toDateStr)(now), weekday: WEEKDAYS_RU[now.getDay()] });
        const user = buildUserMessage(text, ctx);
        let usage;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await this.llm.completeJson({
                    provider: ctx.provider,
                    model: ctx.model,
                    schemaName: 'patient_frame',
                    description: 'Разобранная реплика пациента',
                    schema: frame_1.FRAME_JSON_SCHEMA,
                    messages: [
                        { role: 'system', content: prompt.text },
                        { role: 'user', content: user },
                    ],
                });
                usage = sumUsage(usage, res.usage);
                const frame = (0, frame_1.parseFrame)(res.data);
                if (frame)
                    return { frame, source: 'llm', usage, promptHash: prompt.hash };
                this.logger.warn(`NLU: невалидный ответ (${attempt + 1}): ${res.raw.slice(0, 200)}`);
            }
            catch (err) {
                this.logger.warn(`NLU: ошибка вызова (${attempt + 1}): ${String(err)}`);
            }
        }
        return { frame: { goal: 'other', entities: {} }, source: 'fallback', usage, promptHash: prompt.hash };
    }
};
exports.NluService = NluService;
exports.NluService = NluService = NluService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(llm_port_1.LLM_PORT)),
    __metadata("design:paramtypes", [Object, prompt_builder_service_1.PromptBuilder])
], NluService);
function buildUserMessage(text, ctx) {
    const lines = [];
    if (ctx.stateSummary)
        lines.push(`Состояние диалога: ${ctx.stateSummary}`);
    const waits = describeExpectation(ctx.expectation);
    if (waits)
        lines.push(`Ассистент ждёт: ${waits}`);
    if (ctx.expectation.kind === 'choice') {
        lines.push('Варианты, показанные пациенту:');
        ctx.expectation.options.forEach((o, i) => lines.push(`${i + 1}. ${o.label}`));
    }
    if (ctx.lastAssistant)
        lines.push(`Ассистент: ${ctx.lastAssistant.slice(0, 300)}`);
    for (const u of (ctx.recentUser ?? []).slice(-2))
        lines.push(`Пациент ранее: ${u.slice(0, 200)}`);
    lines.push(`Реплика пациента: ${text}`);
    return lines.join('\n');
}
function sumUsage(a, b) {
    if (!a)
        return b;
    if (!b)
        return a;
    return {
        promptTokens: a.promptTokens + b.promptTokens,
        completionTokens: a.completionTokens + b.completionTokens,
        totalTokens: a.totalTokens + b.totalTokens,
    };
}
function describeExpectation(e) {
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
//# sourceMappingURL=nlu.service.js.map