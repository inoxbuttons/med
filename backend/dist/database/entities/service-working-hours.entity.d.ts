import { Service } from './service.entity';
import { Clinic } from './clinic.entity';
export declare class ServiceWorkingHours {
    id: number;
    serviceId: number;
    clinicId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDuration: number;
    breakStart: string | null;
    breakEnd: string | null;
    isActive: boolean;
    service: Service;
    clinic: Clinic;
    createdAt: Date;
    updatedAt: Date;
}
