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
