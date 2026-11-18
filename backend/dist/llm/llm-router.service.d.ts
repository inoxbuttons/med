import { LlmPort, LlmRequest } from '../core/ports/llm.port';
import { GigaChatService } from './gigachat.service';
import { CompletionResult, JsonCompletionRequest, JsonCompletionResult } from './llm.types';
import { LlmProvider } from '../chat/chat.types';
import { OpenAiService } from './openai.service';
import { QwenService } from './qwen.service';
import { Qwen3Service } from './qwen3.service';
export declare class LlmRouter implements LlmPort {
    private readonly openAi;
    private readonly gigaChat;
    private readonly qwen;
    private readonly qwen3;
    constructor(openAi: OpenAiService, gigaChat: GigaChatService, qwen: QwenService, qwen3: Qwen3Service);
    complete({ provider, messages, tools, model, forceText, thinking }: LlmRequest): Promise<CompletionResult>;
    completeJson(req: JsonCompletionRequest & {
        provider: LlmProvider;
    }): Promise<JsonCompletionResult>;
    private jsonViaText;
}
