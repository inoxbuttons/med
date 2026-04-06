import { Doctor } from './doctor.entity';
import { Service } from './service.entity';
import { Clinic } from './clinic.entity';
export declare enum AppointmentStatus {
    SCHEDULED = "scheduled",
    CONFIRMED = "confirmed",
    CANCELLED = "cancelled",
    COMPLETED = "completed",
    NO_SHOW = "no_show"
}
export declare enum AppointmentSource {
    WEB = "web",
    PHONE = "phone",
    AI = "ai",
    ADMIN = "admin"
}
export declare class Appointment {
    id: number;
    doctorId: number | null;
    serviceId: number | null;
    clinicId: number;
    patientId: number | null;
    doctor: Doctor;
    service: Service;
    clinic: Clinic;
    startTime: Date;
    endTime: Date;
    status: AppointmentStatus;
    source: AppointmentSource;
    comment: string | null;
    createdAt: Date;
    updatedAt: Date;
}
