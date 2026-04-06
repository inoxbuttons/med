import { Person } from './person.entity';
import { Clinic } from './clinic.entity';
export declare class ClinicPatient {
    id: number;
    personId: number;
    clinicId: number;
    externalId: number | null;
    cardNumber: string | null;
    person: Person;
    clinic: Clinic;
    createdAt: Date;
}
