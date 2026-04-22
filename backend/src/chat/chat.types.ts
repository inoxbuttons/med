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

/** Тип МИС, передаётся виджетом как параметр. Null — используется локальная БД. */
export type MisType = 'infoclinica' | 'medflex' | null;

export interface SendMessageDto {
  sessionId: string;
  message: string;
  provider?: LlmProvider;
  model?: string;
  clientId?: number;
  clinicNetId?: number;
  /** Тип МИС: 'medflex', 'infoclinica'. Передаётся виджетом напрямую, не ищется в БД. */
  misType?: MisType;
  /** ID города (MedFlex town_id) для геофильтрации. Зарезервировано. */
  townId?: number;
  /** ID района (MedFlex district_id) для геофильтрации. Зарезервировано. */
  districtId?: number;
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
  /** Тип МИС, установленный при первом запросе сессии. */
  misType?: MisType;
  /** ID города (MedFlex town_id) для геофильтрации расписания. */
  townId?: number;
  /** ID района (MedFlex district_id) для геофильтрации расписания. */
  districtId?: number;
  pendingConflict?: PendingConflict;
  state: SessionState;
  createdAt: Date;
  updatedAt: Date;
}
