export type OperatorRequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';
export type OperatorRequestType = 'service_booking';
export declare class OperatorRequest {
    id: number;
    clinicId: number | null;
    serviceId: number | null;
    doctorId: number | null;
    patientId: number | null;
    patientName: string | null;
    patientPhone: string | null;
    patientBirthday: string | null;
    requestType: OperatorRequestType;
    notes: string | null;
    sessionId: string | null;
    status: OperatorRequestStatus;
    createdAt: Date;
    updatedAt: Date;
}
