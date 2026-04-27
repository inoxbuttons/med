import { Clinic } from './clinic.entity';
export declare class ClinicNet {
    id: number;
    name: string;
    description: string;
    website: string;
    mis: string | null;
    medflexKey: string | null;
    clinics: Clinic[];
    createdAt: Date;
    updatedAt: Date;
}
