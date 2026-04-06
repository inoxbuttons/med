import { ConfigService } from '@nestjs/config';
import { ChatMessage } from '../chat/chat.types';
import { CompletionResult, LlmTool } from './llm.types';
export declare class OpenAiService {
    private readonly config;
    private readonly logger;
    private readonly client;
    constructor(config: ConfigService);
    chat(messages: ChatMessage[], model?: string): Promise<string>;
    complete(messages: ChatMessage[], tools?: LlmTool[], model?: string): Promise<CompletionResult>;
}
