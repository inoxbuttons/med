import { Clinic, Doctor, Service } from '../../../core/domain';
import { CatalogSourcePort } from '../../../core/ports';
import type { MedflexClient } from '../../../integrations/medflex/medflex.client';
import type { MedflexService } from '../../../integrations/medflex/medflex.service';
import type { MfDoctor, MfService } from '../../../integrations/medflex/medflex.types';
import { doctorFromInfo, Memo } from '../shared/mapping';

export interface MedflexNetContext {
  client: MedflexClient;
  /** lpu_group_id MedFlex; исторически совпадает с clinicNetId. */
  lpuGroupId: number;
  townId?: number;
}

export class MedflexCatalogSource implements CatalogSourcePort {
  private readonly clinicsMemo: Memo<Clinic[]>;
  private readonly specNames: Memo<Map<number, string>>;

  constructor(
    readonly clinicNetId: number,
    private readonly mf: MedflexService,
    private readonly ctx: MedflexNetContext,
  ) {
    this.clinicsMemo = new Memo(() => this.mf.getClinics(ctx.client, ctx.lpuGroupId, ctx.townId));
    this.specNames = new Memo(async () => {
      const apiKey = (ctx.client as any).apiKey as string;
      const specs = await this.mf.getCachedSpecialities(ctx.client, apiKey);
      return new Map(specs.map((s) => [s.id, s.name]));
    });
  }

  clinics(): Promise<Clinic[]> {
    return this.clinicsMemo.get();
  }

  async clinicIds(): Promise<number[]> {
    return (await this.clinics()).map((c) => c.id);
  }

  async inNet(clinicId: number): Promise<boolean> {
    return (await this.clinicIds()).includes(clinicId);
  }

  /** Врачи MedFlex в клиниках сети (все страницы). doctorIds — только указанные. */
  async rawDoctors(doctorIds?: number[]): Promise<MfDoctor[]> {
    const lpuIds = await this.clinicIds();
    if (lpuIds.length === 0) return [];
    const out: MfDoctor[] = [];
    for (let page = 1; page <= 20; page++) {
      const res = await this.ctx.client.getDoctors({
        lpuIds: lpuIds.join(','),
        doctorIds: doctorIds?.join(','),
        page,
        size: 100,
      });
      out.push(...res.data);
      if (page >= (res.num_pages ?? 1)) break;
    }
    return out;
  }

  async doctors(): Promise<Doctor[]> {
    const [raw, clinics, specs] = await Promise.all([this.rawDoctors(), this.clinics(), this.specNames.get()]);
    const clinicName = new Map(clinics.map((c) => [c.id, c.name]));
    return raw.map((d) => {
      const specialityId = d.specialities[0] ?? null;
      const price = d.prices?.find((p) => p.speciality_id === specialityId)?.price;
      return {
        id: d.id,
        name: d.efio,
        speciality: specialityId ? (specs.get(specialityId) ?? '') : '',
        specialityId,
        price: typeof price === 'number' ? price : null,
        clinics: d.lpus.filter((id) => clinicName.has(id)).map((id) => ({ id, name: clinicName.get(id)! })),
      };
    });
  }

  /** Услуги по клиникам: lpuId → список MedFlex. */
  async rawServices(): Promise<Array<{ lpuId: number; services: MfService[] }>> {
    const lpuIds = await this.clinicIds();
    return Promise.all(
      lpuIds.map(async (lpuId) => ({ lpuId, services: await this.ctx.client.getServicePrices({ lpuId }) })),
    );
  }

  async services(): Promise<Service[]> {
    const [perLpu, clinics] = await Promise.all([this.rawServices(), this.clinics()]);
    const clinicName = new Map(clinics.map((c) => [c.id, c.name]));
    const byId = new Map<string, Service>();
    for (const { lpuId, services } of perLpu) {
      for (const s of services) {
        let svc = byId.get(s.id);
        if (!svc) {
          // В MedFlex запись на услугу идёт к врачу, который её выполняет — направление не требуется.
          svc = { id: s.id, name: s.name, direction: null, selfBooking: true, atDoctorVisit: false, stationary: false, priceFrom: false, clinics: [] };
          byId.set(s.id, svc);
        }
        svc.clinics.push({ id: lpuId, name: clinicName.get(lpuId) ?? `Клиника #${lpuId}`, price: s.price ?? null });
      }
    }
    return [...byId.values()];
  }

  async searchDoctors(query: string, clinicId?: number): Promise<Doctor[]> {
    const found = await this.mf.findDoctors(this.ctx.client, query, this.ctx.lpuGroupId, clinicId, this.ctx.townId);
    return found.map(doctorFromInfo);
  }

  async searchServices(query: string, clinicId?: number): Promise<Service[]> {
    const q = query.toLowerCase().trim();
    return (await this.services())
      .filter((s) => s.name.toLowerCase().includes(q))
      .filter((s) => !clinicId || s.clinics.some((c) => c.id === clinicId));
  }
}
