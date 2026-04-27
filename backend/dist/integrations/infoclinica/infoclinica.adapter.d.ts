import { ClinicInfo, DoctorInfo, SlotGroup, BookingResult, PatientAppointmentItem, CancellableAppointment } from '../../booking/booking.service';
import { IcFilial, IcDoctor, IcFreeSlot, IcBookingResult } from './infoclinica.types';
export declare function icDateToIso(icDate: string): string;
export declare function isoToIcDate(isoDate: string): string;
export declare function toClinics(filials: IcFilial[]): ClinicInfo[];
export declare function toDoctors(icDoctors: IcDoctor[]): DoctorInfo[];
export declare function toSlotGroups(slots: IcFreeSlot[], filials: IcFilial[], mode: 'nearest' | 'day' | 'week'): SlotGroup[];
export declare function toBookingResult(icResult: IcBookingResult, successMessage?: string): BookingResult;
export interface IcStoredAppointment {
    id: number;
    filialId: number;
    doctorCode: number;
    doctorName: string;
    clinicName: string;
    depName: string;
    date: string;
    time: string;
    patientId?: number;
}
export declare function toPatientAppointmentItem(a: IcStoredAppointment): PatientAppointmentItem;
export declare function toCancellableAppointment(a: IcStoredAppointment): CancellableAppointment;
