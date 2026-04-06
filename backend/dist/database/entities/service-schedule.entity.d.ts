import { Service } from './service.entity';
import { Clinic } from './clinic.entity';
export declare class ServiceSchedule {
    id: number;
    serviceId: number;
    clinicId: number;
    service: Service;
    clinic: Clinic;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    validFrom: string;
    validTo: string;
    createdAt: Date;
    updatedAt: Date;
}
