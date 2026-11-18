import { DataSource, Repository } from 'typeorm';
import { BookingPort, CatalogSourcePort, MisKind } from '../../core/ports';
import { ClinicNet } from '../../database/entities/clinic-net.entity';
import { InfclinicaService } from '../../integrations/infoclinica/infoclinica.service';
import { LocalDbService } from '../../integrations/local/local-db.service';
import { MedflexService } from '../../integrations/medflex/medflex.service';
export interface NetAdapters {
    mis: MisKind;
    booking: BookingPort;
    catalog: CatalogSourcePort;
}
export interface NetAdapterOptions {
    townId?: number;
    districtId?: number;
}
export declare class MisRegistry {
    private readonly nets;
    private readonly db;
    private readonly local;
    private readonly medflex;
    private readonly infoclinica;
    constructor(nets: Repository<ClinicNet>, db: DataSource, local: LocalDbService, medflex: MedflexService, infoclinica: InfclinicaService);
    misOf(clinicNetId: number): Promise<MisKind>;
    forNet(clinicNetId: number, opts?: NetAdapterOptions): Promise<NetAdapters>;
}
export declare function toMisKind(mis: string | null | undefined): MisKind;
