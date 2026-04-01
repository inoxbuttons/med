export type LlmProvider = 'openai' | 'gigachat';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export interface PromptRequest {
  provider: LlmProvider;
  prompt: string;
  model?: string;
}

export interface PromptResponse {
  provider: LlmProvider;
  response: string;
}
