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
var OpenAiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = require("openai");
let OpenAiService = OpenAiService_1 = class OpenAiService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(OpenAiService_1.name);
        this.client = new openai_1.default({
            apiKey: this.config.get('OPENAI_API_KEY'),
        });
    }
    async chat(messages, model = 'gpt-4o-mini') {
        const result = await this.complete(messages, [], model);
        return result.type === 'text' ? result.content : '';
    }
    async complete(messages, tools = [], model = 'gpt-4o-mini') {
        const openaiMessages = messages.map((m) => {
            if (m.role === 'function') {
                return { role: 'user', content: `[Tool result for ${m.name}]: ${m.content}` };
            }
            return { role: m.role, content: m.content };
        });
        const params = {
            model,
            messages: openaiMessages,
        };
        if (tools.length > 0) {
            params.tools = tools.map((t) => ({
                type: 'function',
                function: { name: t.name, description: t.description, parameters: t.parameters },
            }));
            params.tool_choice = 'auto';
        }
        const response = await this.client.chat.completions.create(params);
        const choice = response.choices[0];
        const usage = response.usage
            ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
            }
            : undefined;
        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
            const tc = choice.message.tool_calls[0].function;
            let args = {};
            try {
                args = JSON.parse(tc.arguments);
            }
            catch {
                this.logger.warn(`Failed to parse tool args: ${tc.arguments}`);
            }
            return { type: 'tool_call', toolName: tc.name, toolArgs: args, usage };
        }
        return { type: 'text', content: choice.message.content ?? '', usage };
    }
};
exports.OpenAiService = OpenAiService;
exports.OpenAiService = OpenAiService = OpenAiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenAiService);
//# sourceMappingURL=openai.service.js.map