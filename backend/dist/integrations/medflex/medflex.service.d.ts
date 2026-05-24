import { LlmTool } from '../../llm/llm.types';
import { MedflexClient } from './medflex.client';
import { ClinicInfo, DoctorInfo, SlotGroup, BookingResult, PatientAppointmentItem, SlotMode } from '../../booking/booking.service';
import { PatientData } from '../../chat/chat.types';
export declare class MedflexService {
    private readonly logger;
    private specialityCache;
    private lpuCache;
    getTools(hasPatient?: boolean): LlmTool[];
    executeTool(name: string, args: Record<string, any>, clientId?: number, apiKey?: string | null, lpuGroupId?: number, townId?: number, districtId?: number, patient?: PatientData): Promise<unknown>;
    private findConflictingAppointment;
    private getCachedSpecialities;
    private resolveSpecialities;
    private getCachedLpus;
    getClinics(client: MedflexClient, lpuGroupId: number, townId?: number): Promise<ClinicInfo[]>;
    findDoctors(client: MedflexClient, speciality: string, lpuGroupId: number, clinicId?: number, townId?: number): Promise<Array<DoctorInfo & {
        specialityId: number | null;
    }>>;
    getAvailableSlots(client: MedflexClient, params: {
        doctorId: number;
        clinicId: number;
        lpuGroupId: number;
        mode: SlotMode;
        targetDate?: string;
        townId?: number;
    }): Promise<Array<SlotGroup & {
        dtSlots: Array<{
            dt_start: string;
            dt_end: string;
        }>;
    }>>;
    findDoctorsAndSlots(client: MedflexClient, params: {
        speciality: string;
        clinicId?: number;
        lpuGroupId: number;
        mode: SlotMode;
        targetDate?: string;
        townId?: number;
    }): Promise<unknown[]>;
    findServices(client: MedflexClient, params: {
        query: string;
        lpuGroupId: number;
        clinicId?: number;
        townId?: number;
    }): Promise<unknown[]>;
    bookAppointment(client: MedflexClient, args: {
        doctorId: number;
        clinicId: number;
        specialityId: number;
        startTime: string;
        endTime: string;
        price: number;
        firstName: string;
        lastName: string;
        secondName?: string;
        phone: string;
        birthday: string;
        comment?: string;
    }): Promise<BookingResult>;
    cancelAppointment(client: MedflexClient, uuid: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getPatientAppointments(client: MedflexClient, phone: string, lpuGroupId: number): Promise<Array<PatientAppointmentItem & {
        uuid: string;
        canceled: boolean;
        price: number;
    }>>;
}
