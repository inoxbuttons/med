import { ActionResult, Appointment, BookingOutcome, BookingRequest, OperatorRequestInput, PatientIdentity, Slot, SlotQuery, VisitService } from '../../../core/domain';
import { BookingCapabilities, BookingPort } from '../../../core/ports';
import type { LocalDbService } from '../../../integrations/local/local-db.service';
import { LocalCatalogSource } from './local-catalog.source';
export declare function localRef(kind: 'doctor' | 'service', id: number): string;
export declare function parseLocalRef(ref: string): {
    kind: 'doctor' | 'service';
    id: number;
} | null;
export declare class LocalBookingAdapter implements BookingPort {
    readonly clinicNetId: number;
    private readonly local;
    private readonly catalog;
    readonly mis: "local";
    constructor(clinicNetId: number, local: LocalDbService, catalog: LocalCatalogSource);
    capabilities(): BookingCapabilities;
    findSlots(q: SlotQuery): Promise<Slot[]>;
    visitServices(doctorId: number, clinicId?: number): Promise<VisitService[]>;
    book(req: BookingRequest): Promise<BookingOutcome>;
    cancel(ref: string, patient: PatientIdentity): Promise<ActionResult>;
    reschedule(ref: string, req: BookingRequest): Promise<BookingOutcome>;
    patientAppointments(patient: PatientIdentity): Promise<Appointment[]>;
    createOperatorRequest(input: OperatorRequestInput): Promise<ActionResult & {
        id: number;
    }>;
    private findOwn;
    private outcome;
}
