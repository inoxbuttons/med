import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import { Repository } from 'typeorm';
import { EmbeddingPort } from '../../core/ports/embedding.port';
import { TokenUsage } from '../../database/entities/token-usage.entity';

const BATCH = 32;

/**
 * Эмбеддинги через OpenAI-совместимый API cloud.ru Foundation Models.
 *   EMBEDDINGS_ENABLED=true            — включить (по умолчанию выключено: каждый вызов платный);
 *   EMBEDDINGS_MODEL=BAAI/bge-m3       — модель (размерность 1024 — см. миграцию 017);
 *   EMBEDDINGS_API_KEY / EMBEDDINGS_BASE_URL — по умолчанию QWEN3_API_KEY / QWEN3_BASE_URL.
 * Расход пишется в token_usage (task = 'embed').
 */
@Injectable()
export class CloudRuEmbeddingsService implements EmbeddingPort {
  private readonly logger = new Logger(CloudRuEmbeddingsService.name);
  readonly enabled: boolean;
  readonly model: string;
  readonly dimensions = 1024;
  private readonly client: OpenAI | null;

  constructor(
    config: ConfigService,
    @InjectRepository(TokenUsage) private readonly usage: Repository<TokenUsage>,
  ) {
    this.model = config.get<string>('EMBEDDINGS_MODEL', 'BAAI/bge-m3');
    const apiKey = config.get<string>('EMBEDDINGS_API_KEY') || config.get<string>('QWEN3_API_KEY');
    const baseURL = config.get<string>('EMBEDDINGS_BASE_URL') || config.get<string>('QWEN3_BASE_URL', 'https://foundation-models.api.cloud.ru/v1');
    this.enabled = config.get<string>('EMBEDDINGS_ENABLED') === 'true' && !!apiKey;
    this.client = this.enabled ? new OpenAI({ apiKey, baseURL }) : null;
  }

  async embed(texts: string[], purpose: 'document' | 'query'): Promise<number[][]> {
    if (!this.client) throw new Error('Эмбеддинги выключены (EMBEDDINGS_ENABLED)');
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      const res = await this.client.embeddings.create({ model: this.model, input: batch });
      const vectors = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding as number[]);
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
}
