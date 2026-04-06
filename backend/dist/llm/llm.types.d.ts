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
export interface CompletionToolCall {
    type: 'tool_call';
    toolName: string;
    toolArgs: Record<string, any>;
    functionsStateId?: string;
}
export interface CompletionText {
    type: 'text';
    content: string;
}
export type CompletionResult = CompletionToolCall | CompletionText;
