import { Clinic, Doctor, Service } from '../../../core/domain';
import { CatalogSourcePort } from '../../../core/ports';
import type { MedflexClient } from '../../../integrations/medflex/medflex.client';
import type { MedflexService } from '../../../integrations/medflex/medflex.service';
import type { MfDoctor, MfService } from '../../../integrations/medflex/medflex.types';
export interface MedflexNetContext {
    client: MedflexClient;
    lpuGroupId: number;
    townId?: number;
}
export declare class MedflexCatalogSource implements CatalogSourcePort {
    readonly clinicNetId: number;
    private readonly mf;
    private readonly ctx;
    private readonly clinicsMemo;
    private readonly specNames;
    constructor(clinicNetId: number, mf: MedflexService, ctx: MedflexNetContext);
    clinics(): Promise<Clinic[]>;
    clinicIds(): Promise<number[]>;
    inNet(clinicId: number): Promise<boolean>;
    rawDoctors(doctorIds?: number[]): Promise<MfDoctor[]>;
    doctors(): Promise<Doctor[]>;
    rawServices(): Promise<Array<{
        lpuId: number;
        services: MfService[];
    }>>;
    services(): Promise<Service[]>;
    searchDoctors(query: string, clinicId?: number): Promise<Doctor[]>;
    searchServices(query: string, clinicId?: number): Promise<Service[]>;
}
