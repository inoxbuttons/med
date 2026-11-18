import { ActionResult, Appointment, BookingOutcome, BookingRequest, Clinic, Doctor, OperatorRequestInput, PatientIdentity, Service, Slot, SlotQuery, VisitService } from '../../../core/domain';
import { BookingCapabilities, BookingPort, CatalogSourcePort } from '../../../core/ports';
import type { InfclinicaService } from '../../../integrations/infoclinica/infoclinica.service';
import type { LocalDbService } from '../../../integrations/local/local-db.service';
export declare function icRef(schedId: number, filialId: number): string;
export declare function parseIcRef(ref: string): {
    schedId: number;
    filialId: number;
} | null;
export declare class InfoclinicaCatalogSource implements CatalogSourcePort {
    readonly clinicNetId: number;
    private readonly ic;
    constructor(clinicNetId: number, ic: InfclinicaService);
    clinics(): Promise<Clinic[]>;
    doctors(): Promise<Doctor[]>;
    services(): Promise<Service[]>;
    searchDoctors(query: string, clinicId?: number): Promise<Doctor[]>;
    searchServices(): Promise<Service[]>;
}
export declare class InfoclinicaBookingAdapter implements BookingPort {
    readonly clinicNetId: number;
    private readonly ic;
    private readonly local;
    readonly mis: "infoclinica";
    constructor(clinicNetId: number, ic: InfclinicaService, local: LocalDbService);
    capabilities(): BookingCapabilities;
    findSlots(q: SlotQuery): Promise<Slot[]>;
    visitServices(): Promise<VisitService[]>;
    book(req: BookingRequest): Promise<BookingOutcome>;
    cancel(ref: string, patient: PatientIdentity): Promise<ActionResult>;
    reschedule(ref: string, req: BookingRequest): Promise<BookingOutcome>;
    patientAppointments(patient: PatientIdentity): Promise<Appointment[]>;
    createOperatorRequest(input: OperatorRequestInput): Promise<ActionResult & {
        id: number;
    }>;
    private isOwn;
}
