import { DataSource } from 'typeorm';
import { Clinic, Doctor, Service } from '../../../core/domain';
import { CatalogSourcePort } from '../../../core/ports';
import type { LocalDbService } from '../../../integrations/local/local-db.service';
import { doctorFromInfo, Memo } from '../shared/mapping';

export class LocalCatalogSource implements CatalogSourcePort {
  private readonly clinicsMemo: Memo<Clinic[]>;
  private readonly doctorNames: Memo<Map<number, string>>;

  constructor(
    readonly clinicNetId: number,
    private readonly local: LocalDbService,
    private readonly db: DataSource,
  ) {
    this.clinicsMemo = new Memo(() => this.local.getClinics(this.clinicNetId));
    this.doctorNames = new Memo(async () => new Map((await this.doctors()).map((d) => [d.id, d.name])));
  }

  async doctorName(id: number): Promise<string | undefined> {
    return (await this.doctorNames.get()).get(id);
  }

  clinics(): Promise<Clinic[]> {
    return this.clinicsMemo.get();
  }

  async clinicIds(): Promise<Set<number>> {
    return new Set((await this.clinics()).map((c) => c.id));
  }

  async inNet(clinicId: number): Promise<boolean> {
    return (await this.clinicIds()).has(clinicId);
  }

  async doctors(): Promise<Doctor[]> {
    // Пустая строка = все врачи сети (ILIKE '%%').
    return (await this.local.findDoctors('', undefined, this.clinicNetId)).map(doctorFromInfo);
  }

  async services(): Promise<Service[]> {
    const rows: Array<{
      id: number; name: string; direction: string | null; self_booking: boolean; at_doctor_visit: boolean;
      stationary: boolean; price_from: boolean; clinic_id: number; clinic_name: string; price: string | null;
    }> = await this.db.query(
      `SELECT s.id, s.name, mf.name AS direction, s.self_booking, s.at_doctor_visit, s.stationary, s.price_from,
              c.id AS clinic_id, c.name AS clinic_name, sbc.price
         FROM services s
         JOIN services_by_clinics sbc ON sbc.service_id = s.id
         JOIN clinics c ON c.id = sbc.clinic_id
         LEFT JOIN med_fields mf ON mf.id = s.med_field_id
        WHERE c.clinic_net_id = $1
        ORDER BY s.id, c.id`,
      [this.clinicNetId],
    );
    const byId = new Map<number, Service>();
    for (const r of rows) {
      let s = byId.get(r.id);
      if (!s) {
        s = {
          id: r.id,
          name: r.name,
          direction: r.direction,
          selfBooking: r.self_booking,
          atDoctorVisit: r.at_doctor_visit,
          stationary: r.stationary,
          priceFrom: r.price_from,
          clinics: [],
        };
        byId.set(r.id, s);
      }
      s.clinics.push({ id: r.clinic_id, name: r.clinic_name, price: r.price === null ? null : Number(r.price) || null });
    }
    return [...byId.values()];
  }

  async searchDoctors(query: string, clinicId?: number): Promise<Doctor[]> {
    return (await this.local.findDoctors(query, clinicId, this.clinicNetId)).map(doctorFromInfo);
  }

  async searchServices(query: string, clinicId?: number): Promise<Service[]> {
    return this.local.findServices(query, clinicId, this.clinicNetId);
  }
}
