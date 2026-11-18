export type LlmProvider = 'openai' | 'gigachat' | 'qwen' | 'qwen3';
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
import type { PatientData } from '../core/domain/patient';
export type { PatientData };
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
    payload?: string;
    engine?: 'tools' | 'pipeline';
}
export interface SendMessageResponse {
    sessionId: string;
    reply: string;
    history: ChatMessage[];
    quickReplies?: Array<{
        label: string;
        payload?: string;
    }>;
    engine?: 'tools' | 'pipeline';
}
export interface PendingConfirmation {
    toolName: 'book_appointment' | 'reschedule_appointment' | 'cancel_appointment';
    toolArgs: Record<string, any>;
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
    promptHash?: string;
    provider: LlmProvider;
    model?: string;
    clientId?: number;
    clinicNetId?: number;
    misType?: MisType;
    townId?: number;
    districtId?: number;
    patient?: PatientData;
    recentBookings?: Array<{
        uuid: string;
        description: string;
        startTime: string;
    }>;
    pendingConflict?: PendingConflict;
    pendingConfirmation?: PendingConfirmation;
    completedBookingNotes?: string[];
    foldedNotesCount?: number;
    state: SessionState;
    createdAt: Date;
    updatedAt: Date;
}
