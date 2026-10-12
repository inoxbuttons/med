import { ConfigService } from '@nestjs/config';
import { ChatMessage } from '../chat/chat.types';
import { CompletionResult, LlmTool } from './llm.types';
export declare class Qwen3Service {
    private readonly config;
    private readonly logger;
    private readonly client;
    private readonly defaultModel;
    constructor(config: ConfigService);
    complete(messages: ChatMessage[], tools?: LlmTool[], model?: string, forceText?: boolean): Promise<CompletionResult>;
}
