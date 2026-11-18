import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BookingPort, CatalogSourcePort, MisKind } from '../../core/ports';
import { ClinicNet } from '../../database/entities/clinic-net.entity';
import { InfclinicaService } from '../../integrations/infoclinica/infoclinica.service';
import { LocalDbService } from '../../integrations/local/local-db.service';
import { MedflexService } from '../../integrations/medflex/medflex.service';
import { InfoclinicaBookingAdapter, InfoclinicaCatalogSource } from './infoclinica/infoclinica.adapters';
import { LocalBookingAdapter } from './local/local-booking.adapter';
import { LocalCatalogSource } from './local/local-catalog.source';
import { MedflexBookingAdapter } from './medflex/medflex-booking.adapter';
import { MedflexCatalogSource } from './medflex/medflex-catalog.source';

export interface NetAdapters {
  mis: MisKind;
  booking: BookingPort;
  catalog: CatalogSourcePort;
}

export interface NetAdapterOptions {
  /** Город/район пациента — сужает список клиник MedFlex. */
  townId?: number;
  districtId?: number;
}

/**
 * Выбирает адаптеры МИС для сети клиник по clinic_nets.mis.
 * Экземпляры лёгкие и короткоживущие (кеш справочников — на время жизни экземпляра):
 * создаются на запрос или на ход диалога.
 */
@Injectable()
export class MisRegistry {
  constructor(
    @InjectRepository(ClinicNet) private readonly nets: Repository<ClinicNet>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly local: LocalDbService,
    private readonly medflex: MedflexService,
    private readonly infoclinica: InfclinicaService,
  ) {}

  async misOf(clinicNetId: number): Promise<MisKind> {
    const net = await this.nets.findOne({ where: { id: clinicNetId } });
    if (!net) throw new NotFoundException(`Сеть клиник ${clinicNetId} не найдена`);
    return toMisKind(net.mis);
  }

  async forNet(clinicNetId: number, opts: NetAdapterOptions = {}): Promise<NetAdapters> {
    const net = await this.nets.findOne({ where: { id: clinicNetId } });
    if (!net) throw new NotFoundException(`Сеть клиник ${clinicNetId} не найдена`);
    const mis = toMisKind(net.mis);

    if (mis === 'medflex') {
      const resolved = this.medflex.clientFor(net.medflexKey, clinicNetId);
      if (!resolved) throw new Error(`MedFlex: не настроен клиент для сети ${clinicNetId}`);
      const ctx = { client: resolved.client, lpuGroupId: resolved.lpuGroupId, townId: opts.townId };
      const catalog = new MedflexCatalogSource(clinicNetId, this.medflex, ctx);
      return { mis, catalog, booking: new MedflexBookingAdapter(clinicNetId, this.medflex, this.local, ctx, catalog) };
    }

    if (mis === 'infoclinica') {
      return {
        mis,
        catalog: new InfoclinicaCatalogSource(clinicNetId, this.infoclinica),
        booking: new InfoclinicaBookingAdapter(clinicNetId, this.infoclinica, this.local),
      };
    }

    const catalog = new LocalCatalogSource(clinicNetId, this.local, this.db);
    return { mis, catalog, booking: new LocalBookingAdapter(clinicNetId, this.local, catalog) };
  }
}

export function toMisKind(mis: string | null | undefined): MisKind {
  return mis === 'medflex' || mis === 'infoclinica' ? mis : 'local';
}
