import { Clinic, Doctor, Service } from '../domain';
export interface CatalogSourcePort {
    readonly clinicNetId: number;
    clinics(): Promise<Clinic[]>;
    doctors(): Promise<Doctor[]>;
    services(): Promise<Service[]>;
    searchDoctors(query: string, clinicId?: number): Promise<Doctor[]>;
    searchServices(query: string, clinicId?: number): Promise<Service[]>;
}
