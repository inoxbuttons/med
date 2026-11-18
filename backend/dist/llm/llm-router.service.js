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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmRouter = void 0;
const common_1 = require("@nestjs/common");
const gigachat_service_1 = require("./gigachat.service");
const llm_types_1 = require("./llm.types");
const openai_service_1 = require("./openai.service");
const qwen_service_1 = require("./qwen.service");
const qwen3_service_1 = require("./qwen3.service");
let LlmRouter = class LlmRouter {
    constructor(openAi, gigaChat, qwen, qwen3) {
        this.openAi = openAi;
        this.gigaChat = gigaChat;
        this.qwen = qwen;
        this.qwen3 = qwen3;
    }
    complete({ provider, messages, tools = [], model, forceText = false, thinking }) {
        switch (provider) {
            case 'gigachat':
                return this.gigaChat.complete(messages, tools, model, forceText);
            case 'qwen':
                return this.qwen.complete(messages, tools, model, forceText);
            case 'qwen3':
                return this.qwen3.complete(messages, tools, model, forceText, thinking);
            case 'openai':
            default:
                return this.openAi.complete(messages, forceText ? [] : tools, model);
        }
    }
    completeJson(req) {
        switch (req.provider) {
            case 'qwen3':
                return this.qwen3.completeJson(req);
            case 'gigachat':
                return this.gigaChat.completeJson(req);
            case 'openai':
                return this.openAi.completeJson(req);
            default:
                return this.jsonViaText(req);
        }
    }
    async jsonViaText(req) {
        const instruction = `Ответь только JSON-объектом по схеме:\n${JSON.stringify(req.schema)}`;
        const messages = [{ role: 'system', content: instruction }, ...req.messages];
        const res = await this.complete({ provider: req.provider, messages, model: req.model, forceText: true });
        const raw = res.type === 'text' ? res.content : '';
        return { data: (0, llm_types_1.parseJsonObject)(raw), raw, usage: res.usage };
    }
};
exports.LlmRouter = LlmRouter;
exports.LlmRouter = LlmRouter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_1.OpenAiService,
        gigachat_service_1.GigaChatService,
        qwen_service_1.QwenService,
        qwen3_service_1.Qwen3Service])
], LlmRouter);
//# sourceMappingURL=llm-router.service.js.map