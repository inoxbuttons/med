import { Repository } from 'typeorm';
import { Clinic } from '../../database/entities/clinic.entity';
import { Doctor } from '../../database/entities/doctor.entity';
import { DoctorLocation } from '../../database/entities/doctor-location.entity';
import { DoctorWorkingHours } from '../../database/entities/doctor-working-hours.entity';
import { DoctorException } from '../../database/entities/doctor-exception.entity';
import { Service } from '../../database/entities/service.entity';
import { ServiceByClinic } from '../../database/entities/service-by-clinic.entity';
import { ServiceSchedule } from '../../database/entities/service-schedule.entity';
import { Appointment } from '../../database/entities/appointment.entity';
import { ServiceWorkingHours } from '../../database/entities/service-working-hours.entity';
import { ServiceException } from '../../database/entities/service-exception.entity';
import { ServiceAppointment } from '../../database/entities/service-appointment.entity';
import { LlmTool } from '../../llm/llm.types';
export type SlotMode = 'nearest' | 'day' | 'week';
export interface ClinicInfo {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
}
export interface DoctorInfo {
    id: number;
    name: string;
    speciality: string;
    price: number | null;
    clinics: {
        id: number;
        name: string;
    }[];
}
export interface ServiceInfo {
    id: number;
    name: string;
    direction: string | null;
    clinics: {
        id: number;
        name: string;
        price: number | null;
    }[];
}
export interface SlotGroup {
    date: string;
    dayName: string;
    clinicId: number;
    clinicName: string;
    times: string[];
    note?: string;
}
export interface BookingResult {
    success: boolean;
    appointmentId?: number;
    message: string;
}
export interface PatientAppointmentItem {
    type: 'doctor' | 'service';
    date: string;
    time: string;
    clinicName: string;
    doctorName?: string;
    speciality?: string;
    serviceName?: string;
}
export interface CancellableAppointment extends PatientAppointmentItem {
    id: number;
    doctorId?: number;
    serviceId?: number;
    clinicId: number;
}
export declare class LocalDbService {
    private readonly clinicRepo;
    private readonly doctorRepo;
    private readonly doctorLocationRepo;
    private readonly workingHoursRepo;
    private readonly exceptionRepo;
    private readonly serviceRepo;
    private readonly serviceByClinicRepo;
    private readonly serviceScheduleRepo;
    private readonly appointmentRepo;
    private readonly serviceWorkingHoursRepo;
    private readonly serviceExceptionRepo;
    private readonly serviceAppointmentRepo;
    private readonly logger;
    constructor(clinicRepo: Repository<Clinic>, doctorRepo: Repository<Doctor>, doctorLocationRepo: Repository<DoctorLocation>, workingHoursRepo: Repository<DoctorWorkingHours>, exceptionRepo: Repository<DoctorException>, serviceRepo: Repository<Service>, serviceByClinicRepo: Repository<ServiceByClinic>, serviceScheduleRepo: Repository<ServiceSchedule>, appointmentRepo: Repository<Appointment>, serviceWorkingHoursRepo: Repository<ServiceWorkingHours>, serviceExceptionRepo: Repository<ServiceException>, serviceAppointmentRepo: Repository<ServiceAppointment>);
    getClinics(): Promise<ClinicInfo[]>;
    findDoctors(speciality: string, clinicId?: number): Promise<DoctorInfo[]>;
    findServices(query: string, clinicId?: number): Promise<ServiceInfo[]>;
    getAvailableSlots(params: {
        doctorId?: number;
        serviceId?: number;
        clinicId?: number;
        mode?: SlotMode;
        targetDate?: string;
    }): Promise<SlotGroup[]>;
    getDoctorSlots(doctorId: number, clinicId: number | undefined, mode: SlotMode, targetDate?: string): Promise<SlotGroup[]>;
    getServiceSlots(serviceId: number, clinicId: number | undefined, mode: SlotMode, targetDate?: string): Promise<SlotGroup[]>;
    bookAppointment(params: {
        doctorId?: number;
        serviceId?: number;
        clinicId: number;
        startTime: string;
        patientId?: number;
        source?: string;
        comment?: string;
    }): Promise<BookingResult>;
    private bookServiceAppointment;
    resolveClinicIdByName(clinicId?: number, clinicName?: string): Promise<number | undefined>;
    findDoctorsAndSlots(params: {
        speciality: string;
        clinicId?: number;
        clinicName?: string;
        date?: string;
        time?: string;
        mode?: SlotMode;
    }): Promise<Array<{
        doctorId: number;
        doctorName: string;
        speciality: string;
        clinicId?: number;
        clinicName?: string;
        isAvailable: boolean;
        requestedDate?: string;
        requestedTime?: string;
        slot?: {
            date: string;
            time: string;
            clinicId: number;
            clinicName: string;
        } | null;
        allSlots?: Array<{
            date: string;
            time: string;
            clinicId: number;
            clinicName: string;
        }>;
    }>>;
    findAvailableAtTime(params: {
        speciality: string;
        date: string;
        time: string;
        clinicId?: number;
    }): Promise<{
        available: (SlotGroup & {
            doctorId: number;
            doctorName: string;
        })[];
        nearest: (SlotGroup & {
            doctorId: number;
            doctorName: string;
        })[];
    }>;
    checkPatientTimeConflict(clientId: number, startTime: string): Promise<{
        description: string;
        id: number;
        type: 'doctor' | 'service';
    } | null>;
    getPatientAppointments(clientId: number, limit?: number): Promise<PatientAppointmentItem[]>;
    findPatientAppointment(clientId: number, params: {
        query?: string;
        date?: string;
        time?: string;
    }): Promise<CancellableAppointment[]>;
    cancelAppointment(id: number, type: 'doctor' | 'service'): Promise<{
        success: boolean;
        message: string;
    }>;
    rescheduleAppointment(params: {
        oldId: number;
        type: 'doctor' | 'service';
        doctorId?: number;
        serviceId?: number;
        clinicId: number;
        newStartTime: string;
        patientId?: number;
        comment?: string;
    }): Promise<BookingResult>;
    getTools(): LlmTool[];
    executeTool(name: string, args: Record<string, any>, clientId?: number): Promise<unknown>;
}
