import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { EmbeddingPort } from '../../core/ports/embedding.port';
import { TokenUsage } from '../../database/entities/token-usage.entity';
export declare class CloudRuEmbeddingsService implements EmbeddingPort {
    private readonly usage;
    private readonly logger;
    readonly enabled: boolean;
    readonly model: string;
    readonly dimensions = 1024;
    private readonly client;
    constructor(config: ConfigService, usage: Repository<TokenUsage>);
    embed(texts: string[], purpose: 'document' | 'query'): Promise<number[][]>;
}
