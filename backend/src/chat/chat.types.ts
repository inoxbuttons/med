export type LlmProvider = 'openai' | 'gigachat';

export type MessageRole = 'system' | 'user' | 'assistant' | 'function';

/** Internal chat message — covers both plain text and tool-call turns */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  /** For role='function': name of the tool whose result this is */
  name?: string;
  /** For role='assistant': GigaChat function_call the model requested */
  function_call?: { name: string; arguments: string };
  /** GigaChat-specific state id returned in assistant tool-call messages */
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

export interface SessionData {
  messages: ChatMessage[];
  provider: LlmProvider;
  model?: string;
  clientId?: number;
  clinicNetId?: number;
  pendingConflict?: PendingConflict;
  createdAt: Date;
  updatedAt: Date;
}
