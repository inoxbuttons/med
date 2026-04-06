import { Service } from './service.entity';
export declare enum ServiceExceptionType {
    DAY_OFF = "day_off",
    MAINTENANCE = "maintenance",
    OTHER = "other"
}
export declare class ServiceException {
    id: number;
    serviceId: number;
    date: string;
    startTime: string | null;
    endTime: string | null;
    type: ServiceExceptionType;
    comment: string | null;
    service: Service;
    createdAt: Date;
    updatedAt: Date;
}
