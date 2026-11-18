import type { ChatMessage } from '../chat/chat.types';

export interface LlmTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompletionToolCall {
  type: 'tool_call';
  toolName: string;
  toolArgs: Record<string, any>;
  /** GigaChat-specific: functions_state_id from the assistant message */
  functionsStateId?: string;
  usage?: LlmUsage;
}

export interface CompletionText {
  type: 'text';
  content: string;
  usage?: LlmUsage;
}

export type CompletionResult = CompletionToolCall | CompletionText;

/** Запрос ответа строго по JSON-схеме (разбор реплики и т. п.). */
export interface JsonCompletionRequest {
  messages: ChatMessage[];
  /** JSON Schema объекта ответа (подмножество, понятное всем провайдерам: без union-типов). */
  schema: Record<string, unknown>;
  schemaName: string;
  description?: string;
  model?: string;
}

export interface JsonCompletionResult {
  /** Распарсенный объект; null — модель вернула не-JSON. */
  data: unknown;
  raw: string;
  usage?: LlmUsage;
}

/** Достаёт JSON-объект из ответа модели (снимает ```json-обёртку и текст вокруг). */
export function parseJsonObject(text: string): unknown {
  const s = (text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}
