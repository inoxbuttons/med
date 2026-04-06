import { ConfigService } from '@nestjs/config';
import { ChatMessage } from '../chat/chat.types';
import { CompletionResult, LlmTool } from './llm.types';
export declare class GigaChatService {
    private readonly config;
    private readonly logger;
    private accessToken;
    private tokenExpiresAt;
    private readonly authUrl;
    private readonly apiUrl;
    constructor(config: ConfigService);
    private getAccessToken;
    chat(messages: ChatMessage[], model?: string): Promise<string>;
    complete(messages: ChatMessage[], tools?: LlmTool[], model?: string, forceText?: boolean): Promise<CompletionResult>;
}
