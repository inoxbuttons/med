import { Speciality } from './speciality.entity';
import { Service } from './service.entity';
export declare class MedField {
    id: number;
    name: string;
    description: string;
    specialities: Speciality[];
    services: Service[];
    createdAt: Date;
    updatedAt: Date;
}
