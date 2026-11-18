import { Appointment, PatientData, ServiceId, Slot, VisitService } from '../domain';
import { Frame, FrameEntities, Goal } from '../nlu/frame';
import { Expectation } from '../nlu/rule-parser';
export type Target = {
    kind: 'doctor';
    doctorId: number;
    name: string;
    speciality?: string;
} | {
    kind: 'speciality';
    title: string;
    doctorIds: number[];
} | {
    kind: 'service';
    serviceId: ServiceId;
    name: string;
    selfBooking: boolean;
    atDoctorVisit: boolean;
    direction: string | null;
    clinics: Array<{
        id: number;
        name: string;
        price: number | null;
    }>;
    priceFrom: boolean;
};
export type Option = {
    kind: 'target';
    target: Target;
    label: string;
} | {
    kind: 'slot';
    slot: Slot;
    label: string;
} | {
    kind: 'appointment';
    appointment: Appointment;
    label: string;
} | {
    kind: 'visit';
    visit: VisitService;
    label: string;
} | {
    kind: 'action';
    action: 'replace' | 'keep_both' | 'other_time';
    label: string;
} | {
    kind: 'area';
    targets: Target[];
    aliases: string[];
    label: string;
};
export interface DialogState {
    goal: Goal | null;
    entities: FrameEntities;
    target?: Target;
    slot?: Slot;
    visit?: VisitService | null;
    appointment?: Appointment;
    conflictRef?: string | null;
    hasReferral?: boolean;
    options: Option[];
    expectation: Expectation;
    queue: Frame[];
    offerBooking?: boolean;
    excludeDate?: string;
}
export interface DialogSession {
    id: string;
    clinicNetId: number;
    clientId?: number;
    townId?: number;
    districtId?: number;
    patient?: PatientData;
    provider: import('../../chat/chat.types').LlmProvider;
    model?: string;
    state: DialogState;
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    updatedAt: number;
}
export declare function emptyState(): DialogState;
export declare function invalidate(state: DialogState, changed: Array<keyof FrameEntities | string>): void;
export declare function summarize(state: DialogState): string;
