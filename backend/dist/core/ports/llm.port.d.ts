import { ChatMessage, LlmProvider } from '../../chat/chat.types';
import { CompletionResult, JsonCompletionRequest, JsonCompletionResult, LlmTool } from '../../llm/llm.types';
export interface LlmRequest {
    provider: LlmProvider;
    messages: ChatMessage[];
    tools?: LlmTool[];
    model?: string;
    forceText?: boolean;
    thinking?: boolean;
}
export interface LlmPort {
    complete(request: LlmRequest): Promise<CompletionResult>;
    completeJson(request: JsonCompletionRequest & {
        provider: LlmProvider;
    }): Promise<JsonCompletionResult>;
}
export declare const LLM_PORT: unique symbol;
