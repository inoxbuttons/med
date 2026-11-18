import { ServiceId } from './catalog';
import { PatientIdentity } from './patient';
import { Slot } from './slot';
export interface Appointment {
    ref: string;
    kind: 'doctor' | 'service';
    date: string;
    time: string;
    clinicId: number | null;
    clinicName: string;
    doctorId?: number;
    doctorName?: string;
    speciality?: string;
    serviceId?: ServiceId;
    serviceName?: string;
}
export interface BookingRequest {
    slot: Slot;
    doctorId?: number;
    serviceId?: ServiceId;
    visitServiceId?: ServiceId;
    patient: PatientIdentity;
    comment?: string;
}
export type BookingRejectReason = 'past_time' | 'not_found' | 'slot_taken' | 'outside_net' | 'patient_data_required' | 'invalid_patient_data' | 'not_supported' | 'error';
export type BookingOutcome = {
    status: 'booked';
    appointmentRef: string;
    message: string;
} | {
    status: 'conflict';
    existingRef: string | null;
    description: string | null;
    message: string;
} | {
    status: 'rejected';
    reason: BookingRejectReason;
    message: string;
    missing?: string[];
};
export interface OperatorRequestInput {
    clinicId?: number;
    serviceId?: ServiceId;
    doctorId?: number;
    patient: PatientIdentity;
    notes?: string;
    sessionId?: string;
}
export interface ActionResult {
    success: boolean;
    message: string;
}
