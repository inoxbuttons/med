import { Clinic } from './clinic.entity';
export declare class ClinicNet {
    id: number;
    name: string;
    description: string;
    website: string;
    clinics: Clinic[];
    createdAt: Date;
    updatedAt: Date;
}
