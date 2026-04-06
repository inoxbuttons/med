import { Doctor } from './doctor.entity';
import { Clinic } from './clinic.entity';
export declare class DoctorWorkingHours {
    id: number;
    doctorId: number;
    clinicId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDuration: number;
    breakStart: string | null;
    breakEnd: string | null;
    isActive: boolean;
    doctor: Doctor;
    clinic: Clinic;
    createdAt: Date;
    updatedAt: Date;
}
