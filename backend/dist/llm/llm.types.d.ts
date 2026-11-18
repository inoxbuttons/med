import type { ChatMessage } from '../chat/chat.types';
export interface LlmTool {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, {
            type: string;
            description?: string;
            enum?: string[];
        }>;
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
    functionsStateId?: string;
    usage?: LlmUsage;
}
export interface CompletionText {
    type: 'text';
    content: string;
    usage?: LlmUsage;
}
export type CompletionResult = CompletionToolCall | CompletionText;
export interface JsonCompletionRequest {
    messages: ChatMessage[];
    schema: Record<string, unknown>;
    schemaName: string;
    description?: string;
    model?: string;
}
export interface JsonCompletionResult {
    data: unknown;
    raw: string;
    usage?: LlmUsage;
}
export declare function parseJsonObject(text: string): unknown;
