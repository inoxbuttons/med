import { Service } from './service.entity';
import { Clinic } from './clinic.entity';
export declare class ServiceAppointment {
    id: number;
    serviceId: number;
    clinicId: number;
    patientId: number | null;
    service: Service;
    clinic: Clinic;
    startTime: Date;
    endTime: Date;
    status: string;
    source: string;
    comment: string | null;
    createdAt: Date;
    updatedAt: Date;
}
