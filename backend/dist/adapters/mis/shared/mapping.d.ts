import { Appointment, Doctor, ServiceId, Slot } from '../../../core/domain';
import type { CancellableAppointment, DoctorInfo, SlotGroup } from '../../../integrations/local/local-db.service';
export declare function slotsFromGroups(groups: SlotGroup[], extra?: {
    doctorId?: number;
    doctorName?: string;
    serviceId?: ServiceId;
}): Slot[];
export declare function sortSlots(slots: Slot[]): Slot[];
export declare function doctorFromInfo(d: DoctorInfo & {
    specialityId?: number | null;
}): Doctor;
export declare function appointmentFromCancellable(a: CancellableAppointment, ref: string): Appointment;
export declare class Memo<T> {
    private readonly load;
    private value;
    constructor(load: () => Promise<T>);
    get(): Promise<T>;
}
