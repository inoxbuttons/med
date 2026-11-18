import { ConfigService } from '@nestjs/config';
import { ChatMessage } from '../chat/chat.types';
import { CompletionResult, JsonCompletionRequest, JsonCompletionResult, LlmTool } from './llm.types';
export declare class Qwen3Service {
    private readonly config;
    private readonly logger;
    private readonly client;
    private readonly defaultModel;
    constructor(config: ConfigService);
    complete(messages: ChatMessage[], tools?: LlmTool[], model?: string, forceText?: boolean, thinking?: boolean): Promise<CompletionResult>;
    completeJson(req: JsonCompletionRequest): Promise<JsonCompletionResult>;
}
