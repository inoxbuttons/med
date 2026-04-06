import { Doctor } from './doctor.entity';
import { Clinic } from './clinic.entity';
export declare class DoctorLocation {
    doctorId: number;
    clinicId: number;
    doctor: Doctor;
    clinic: Clinic;
    price: number;
}
