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
var CloudRuEmbeddingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudRuEmbeddingsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const openai_1 = require("openai");
const typeorm_2 = require("typeorm");
const token_usage_entity_1 = require("../../database/entities/token-usage.entity");
const BATCH = 32;
let CloudRuEmbeddingsService = CloudRuEmbeddingsService_1 = class CloudRuEmbeddingsService {
    constructor(config, usage) {
        this.usage = usage;
        this.logger = new common_1.Logger(CloudRuEmbeddingsService_1.name);
        this.dimensions = 1024;
        this.model = config.get('EMBEDDINGS_MODEL', 'BAAI/bge-m3');
        const apiKey = config.get('EMBEDDINGS_API_KEY') || config.get('QWEN3_API_KEY');
        const baseURL = config.get('EMBEDDINGS_BASE_URL') || config.get('QWEN3_BASE_URL', 'https://foundation-models.api.cloud.ru/v1');
        this.enabled = config.get('EMBEDDINGS_ENABLED') === 'true' && !!apiKey;
        this.client = this.enabled ? new openai_1.default({ apiKey, baseURL }) : null;
    }
    async embed(texts, purpose) {
        if (!this.client)
            throw new Error('Эмбеддинги выключены (EMBEDDINGS_ENABLED)');
        const out = [];
        for (let i = 0; i < texts.length; i += BATCH) {
            const batch = texts.slice(i, i + BATCH);
            const res = await this.client.embeddings.create({ model: this.model, input: batch });
            const vectors = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
            for (const v of vectors) {
                if (v.length !== this.dimensions) {
                    throw new Error(`${this.model}: размерность ${v.length}, ожидается ${this.dimensions}`);
                }
            }
            out.push(...vectors);
            const tokens = res.usage?.total_tokens ?? res.usage?.prompt_tokens ?? 0;
            this.usage
                .save({ clinicNetId: null, sessionId: `embed:${purpose}`, provider: 'cloudru', promptTokens: tokens, completionTokens: 0, totalTokens: tokens, task: 'embed', promptHash: null })
                .catch((err) => this.logger.warn(`token_usage: ${String(err)}`));
        }
        return out;
    }
};
exports.CloudRuEmbeddingsService = CloudRuEmbeddingsService;
exports.CloudRuEmbeddingsService = CloudRuEmbeddingsService = CloudRuEmbeddingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(token_usage_entity_1.TokenUsage)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_2.Repository])
], CloudRuEmbeddingsService);
//# sourceMappingURL=cloudru-embeddings.service.js.map