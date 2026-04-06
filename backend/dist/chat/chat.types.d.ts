export type LlmProvider = 'openai' | 'gigachat';
export type MessageRole = 'system' | 'user' | 'assistant' | 'function';
export interface ChatMessage {
    role: MessageRole;
    content: string;
    name?: string;
    function_call?: {
        name: string;
        arguments: string;
    };
    functions_state_id?: string;
}
export interface SendMessageDto {
    sessionId: string;
    message: string;
    provider?: LlmProvider;
    model?: string;
    clientId?: number;
    clinicNetId?: number;
}
export interface SendMessageResponse {
    sessionId: string;
    reply: string;
    history: ChatMessage[];
}
export interface PendingConflict {
    oldId: number;
    oldType: 'doctor' | 'service';
    newDoctorId?: number;
    newServiceId?: number;
    newClinicId: number;
    newStartTime: string;
}
export type SessionState = 'idle' | 'conflict_resolution';
export interface SessionData {
    messages: ChatMessage[];
    provider: LlmProvider;
    model?: string;
    clientId?: number;
    clinicNetId?: number;
    pendingConflict?: PendingConflict;
    state: SessionState;
    createdAt: Date;
    updatedAt: Date;
}
