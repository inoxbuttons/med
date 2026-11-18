import { DataSource } from 'typeorm';
import { Clinic, Doctor, Service } from '../../../core/domain';
import { CatalogSourcePort } from '../../../core/ports';
import type { LocalDbService } from '../../../integrations/local/local-db.service';
export declare class LocalCatalogSource implements CatalogSourcePort {
    readonly clinicNetId: number;
    private readonly local;
    private readonly db;
    private readonly clinicsMemo;
    private readonly doctorNames;
    constructor(clinicNetId: number, local: LocalDbService, db: DataSource);
    doctorName(id: number): Promise<string | undefined>;
    clinics(): Promise<Clinic[]>;
    clinicIds(): Promise<Set<number>>;
    inNet(clinicId: number): Promise<boolean>;
    doctors(): Promise<Doctor[]>;
    services(): Promise<Service[]>;
    searchDoctors(query: string, clinicId?: number): Promise<Doctor[]>;
    searchServices(query: string, clinicId?: number): Promise<Service[]>;
}
