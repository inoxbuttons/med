import { Service } from './service.entity';
import { Clinic } from './clinic.entity';
export declare class ServiceByClinic {
    serviceId: number;
    clinicId: number;
    service: Service;
    clinic: Clinic;
    price: number;
    createdAt: Date;
    updatedAt: Date;
}
