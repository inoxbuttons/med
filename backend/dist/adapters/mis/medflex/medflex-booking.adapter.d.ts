import { ActionResult, Appointment, BookingOutcome, BookingRequest, OperatorRequestInput, PatientIdentity, Slot, SlotQuery, VisitService } from '../../../core/domain';
import { BookingCapabilities, BookingPort } from '../../../core/ports';
import type { LocalDbService } from '../../../integrations/local/local-db.service';
import type { MedflexService } from '../../../integrations/medflex/medflex.service';
import { MedflexCatalogSource, MedflexNetContext } from './medflex-catalog.source';
interface MfSlotRef {
    dtStart: string;
    dtEnd: string;
    specialityId: number | null;
    price: number | null;
}
export declare function encodeMfRef(r: MfSlotRef): string;
export declare function decodeMfRef(ref?: string): MfSlotRef | null;
export declare class MedflexBookingAdapter implements BookingPort {
    readonly clinicNetId: number;
    private readonly mf;
    private readonly local;
    private readonly ctx;
    private readonly catalog;
    readonly mis: "medflex";
    constructor(clinicNetId: number, mf: MedflexService, local: LocalDbService, ctx: MedflexNetContext, catalog: MedflexCatalogSource);
    capabilities(): BookingCapabilities;
    findSlots(q: SlotQuery): Promise<Slot[]>;
    visitServices(_doctorId: number, _clinicId?: number): Promise<VisitService[]>;
    book(req: BookingRequest): Promise<BookingOutcome>;
    cancel(ref: string, patient: PatientIdentity): Promise<ActionResult>;
    reschedule(ref: string, req: BookingRequest): Promise<BookingOutcome>;
    patientAppointments(patient: PatientIdentity): Promise<Appointment[]>;
    createOperatorRequest(input: OperatorRequestInput): Promise<ActionResult & {
        id: number;
    }>;
    private isOwn;
    private doctorSlots;
}
export {};
