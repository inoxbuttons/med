import { Speciality } from './speciality.entity';
export declare class Doctor {
    id: number;
    specialityId: number;
    speciality: Speciality;
    name: string;
    photoUrl: string;
    profileUrl: string;
    createdAt: Date;
    updatedAt: Date;
}
