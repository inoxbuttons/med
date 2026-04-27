import { ClinicInfo, DoctorInfo, SlotGroup, BookingResult, PatientAppointmentItem, CancellableAppointment, SlotMode } from '../../booking/booking.service';
export declare class InfclinicaService {
    private readonly logger;
    private readonly client;
    private readonly storedAppointments;
    constructor();
    getClinics(): Promise<ClinicInfo[]>;
    findDoctors(speciality: string, filialId?: number): Promise<DoctorInfo[]>;
    getAvailableSlots(params: {
        doctorId: number;
        filialId?: number;
        mode?: SlotMode;
        targetDate?: string;
    }): Promise<SlotGroup[]>;
    bookAppointment(params: {
        doctorId: number;
        clinicId: number;
        startTime: string;
        patientId?: number;
        comment?: string;
    }): Promise<BookingResult>;
    cancelAppointment(schedId: number, filialId: number): Promise<{
        success: boolean;
        message: string;
    }>;
    getPatientAppointments(clientId: number, limit?: number): Promise<PatientAppointmentItem[]>;
    findPatientAppointment(clientId: number, params: {
        query?: string;
        date?: string;
        time?: string;
    }): Promise<CancellableAppointment[]>;
    executeTool(name: string, args: Record<string, any>, clientId?: number): Promise<unknown>;
}
