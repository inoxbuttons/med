export interface Clinic {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
}
export interface ClinicRef {
    id: number;
    name: string;
}
export interface Doctor {
    id: number;
    name: string;
    speciality: string;
    specialityId: number | null;
    price: number | null;
    clinics: ClinicRef[];
}
export type ServiceId = number | string;
export interface Service {
    id: ServiceId;
    name: string;
    direction: string | null;
    selfBooking: boolean;
    atDoctorVisit: boolean;
    stationary: boolean;
    priceFrom: boolean;
    clinics: Array<ClinicRef & {
        price: number | null;
    }>;
}
export interface VisitService {
    id: ServiceId;
    name: string;
    price: number | null;
    priceFrom: boolean;
    clinicId: number;
    clinicName: string;
}
