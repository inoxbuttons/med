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
var GigaChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GigaChatService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let GigaChatService = GigaChatService_1 = class GigaChatService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(GigaChatService_1.name);
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        this.authUrl = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
        this.apiUrl = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
    }
    async getAccessToken() {
        const now = Date.now();
        if (this.accessToken && now < this.tokenExpiresAt - 60_000) {
            return this.accessToken;
        }
        const credentials = this.config.get('GIGACHAT_CREDENTIALS');
        const scope = this.config.get('GIGACHAT_SCOPE') ?? 'GIGACHAT_API_PERS';
        const response = await fetch(this.authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                Authorization: `Basic ${credentials}`,
                RqUID: crypto.randomUUID(),
            },
            body: new URLSearchParams({ scope }),
        });
        if (!response.ok) {
            throw new Error(`GigaChat auth failed: ${response.statusText}`);
        }
        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiresAt = data.expires_at;
        return this.accessToken;
    }
    async chat(messages, model = 'GigaChat-Pro') {
        const result = await this.complete(messages, [], model);
        return result.type === 'text' ? result.content : '';
    }
    async complete(messages, tools = [], model = 'GigaChat-Pro', forceText = false) {
        const token = await this.getAccessToken();
        const gigaChatMessages = messages.map((m) => {
            if (m.role === 'assistant' && m.function_call) {
                let args;
                try {
                    args = typeof m.function_call.arguments === 'string'
                        ? JSON.parse(m.function_call.arguments)
                        : m.function_call.arguments;
                }
                catch {
                    args = {};
                }
                return { ...m, function_call: { ...m.function_call, arguments: args } };
            }
            return m;
        });
        const body = { model, messages: gigaChatMessages };
        if (tools.length > 0) {
            body.functions = tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            }));
            body.function_call = forceText ? 'none' : 'auto';
        }
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => response.statusText);
            throw new Error(`GigaChat request failed: ${response.status} ${text}`);
        }
        const data = await response.json();
        const usage = data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            }
            : undefined;
        if (usage) {
            this.logger.debug(`Tokens — prompt: ${usage.promptTokens}, completion: ${usage.completionTokens}, total: ${usage.totalTokens}`);
        }
        const choice = data.choices[0];
        if (choice.finish_reason === 'function_call' && choice.message.function_call) {
            let args = {};
            try {
                args = typeof choice.message.function_call.arguments === 'string'
                    ? JSON.parse(choice.message.function_call.arguments)
                    : choice.message.function_call.arguments;
            }
            catch {
                this.logger.warn(`Failed to parse function args: ${choice.message.function_call.arguments}`);
            }
            return {
                type: 'tool_call',
                toolName: choice.message.function_call.name,
                toolArgs: args,
                functionsStateId: choice.message.functions_state_id,
                usage,
            };
        }
        return { type: 'text', content: choice.message.content, usage };
    }
};
exports.GigaChatService = GigaChatService;
exports.GigaChatService = GigaChatService = GigaChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GigaChatService);
//# sourceMappingURL=gigachat.service.js.map