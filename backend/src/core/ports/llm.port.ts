import { ChatMessage, LlmProvider } from '../../chat/chat.types';
import { CompletionResult, JsonCompletionRequest, JsonCompletionResult, LlmTool } from '../../llm/llm.types';

export interface LlmRequest {
  provider: LlmProvider;
  messages: ChatMessage[];
  tools?: LlmTool[];
  model?: string;
  /** Запретить вызовы инструментов — нужен только текст. */
  forceText?: boolean;
  /** false — выключить режим рассуждений (Qwen): короткие ответы без тысяч скрытых токенов. */
  thinking?: boolean;
}

/**
 * Вызов языковой модели независимо от провайдера.
 */
export interface LlmPort {
  complete(request: LlmRequest): Promise<CompletionResult>;
  /** Ответ по JSON-схеме. Провайдер без нативной поддержки — JSON в тексте. */
  completeJson(request: JsonCompletionRequest & { provider: LlmProvider }): Promise<JsonCompletionResult>;
}

export const LLM_PORT = Symbol('LLM_PORT');
