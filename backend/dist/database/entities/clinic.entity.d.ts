import { ClinicNet } from './clinic-net.entity';
import { DoctorLocation } from './doctor-location.entity';
import { ServiceByClinic } from './service-by-clinic.entity';
import { ServiceSchedule } from './service-schedule.entity';
export declare class Clinic {
    id: number;
    clinicNetId: number;
    clinicNet: ClinicNet;
    name: string;
    address: string;
    phone: string;
    email: string;
    latitude: number;
    longitude: number;
    doctorLocations: DoctorLocation[];
    servicesByClinics: ServiceByClinic[];
    serviceSchedules: ServiceSchedule[];
    createdAt: Date;
    updatedAt: Date;
}
