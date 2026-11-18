import { ActionResult, Appointment, BookingOutcome, BookingRequest, OperatorRequestInput, PatientIdentity, ServiceId, Slot, SlotQuery, VisitService } from '../domain';
export type MisKind = 'local' | 'medflex' | 'infoclinica';
export interface BookingCapabilities {
    serviceBooking: boolean;
    visitServices: boolean;
    patientAppointments: 'client_id' | 'phone' | 'none';
    guestBooking: boolean;
    guestRequiredFields: Array<'fullName' | 'phone' | 'birthday'>;
    reschedule: 'atomic' | 'cancel_then_book' | 'none';
}
export interface BookingPort {
    readonly mis: MisKind;
    readonly clinicNetId: number;
    capabilities(): BookingCapabilities;
    findSlots(query: SlotQuery): Promise<Slot[]>;
    visitServices(doctorId: number, clinicId?: number): Promise<VisitService[]>;
    book(request: BookingRequest): Promise<BookingOutcome>;
    cancel(appointmentRef: string, patient: PatientIdentity): Promise<ActionResult>;
    reschedule(appointmentRef: string, request: BookingRequest): Promise<BookingOutcome>;
    patientAppointments(patient: PatientIdentity): Promise<Appointment[]>;
    createOperatorRequest(input: OperatorRequestInput): Promise<ActionResult & {
        id: number;
    }>;
}
export declare function resolveSlot(port: BookingPort, target: {
    doctorId?: number;
    serviceId?: ServiceId;
    clinicId?: number;
    start: string;
}): Promise<Slot | null>;
