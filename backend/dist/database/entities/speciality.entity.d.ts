import { MedField } from './med-field.entity';
import { Doctor } from './doctor.entity';
export declare class Speciality {
    id: number;
    medFieldId: number;
    medField: MedField;
    name: string;
    description: string;
    doctors: Doctor[];
    createdAt: Date;
    updatedAt: Date;
}
