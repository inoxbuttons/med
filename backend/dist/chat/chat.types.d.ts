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
export type MisType = 'infoclinica' | 'medflex' | null;
export interface PatientData {
    firstName: string;
    lastName: string;
    secondName?: string;
    phone: string;
    birthday: string;
}
export interface EncryptedPatient {
    k: string;
    iv: string;
    d: string;
}
export interface SendMessageDto {
    sessionId: string;
    message: string;
    provider?: LlmProvider;
    model?: string;
    clientId?: number;
    clinicNetId?: number;
    misType?: MisType;
    townId?: number;
    districtId?: number;
    encryptedPatient?: EncryptedPatient;
}
export interface SendMessageResponse {
    sessionId: string;
    reply: string;
    history: ChatMessage[];
}
export interface PendingConflict {
    oldId: number;
    oldType: 'doctor' | 'service';
    oldUuid?: string;
    existingDescription?: string;
    newDoctorId?: number;
    newServiceId?: number;
    newClinicId: number;
    newStartTime: string;
    pendingBookingArgs?: Record<string, any>;
}
export type SessionState = 'idle' | 'conflict_resolution';
export interface SessionData {
    messages: ChatMessage[];
    provider: LlmProvider;
    model?: string;
    clientId?: number;
    clinicNetId?: number;
    misType?: MisType;
    townId?: number;
    districtId?: number;
    patient?: PatientData;
    pendingConflict?: PendingConflict;
    state: SessionState;
    createdAt: Date;
    updatedAt: Date;
}
