import { Clinic, Doctor, Service } from '../domain';

/**
 * Каталог сети из МИС. Полные списки (clinics/doctors/services) нужны для построения
 * поискового индекса (этап 3). search* — текущий поиск МИС; заменяется гибридным поиском
 * по индексу, но остаётся запасным вариантом.
 */
export interface CatalogSourcePort {
  readonly clinicNetId: number;

  clinics(): Promise<Clinic[]>;
  doctors(): Promise<Doctor[]>;
  /** Пусто, если МИС не отдаёт услуги. */
  services(): Promise<Service[]>;

  searchDoctors(query: string, clinicId?: number): Promise<Doctor[]>;
  searchServices(query: string, clinicId?: number): Promise<Service[]>;
}
