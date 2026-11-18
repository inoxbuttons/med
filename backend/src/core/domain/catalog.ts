/**
 * Каталог сети клиник: клиники, врачи, услуги.
 * Доменные типы не зависят от МИС — адаптеры приводят свои форматы к ним.
 */

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
  /** Нужен МИС, где запись идёт «врач + специальность» (MedFlex). */
  specialityId: number | null;
  /** Цена приёма, если МИС её отдаёт на уровне врача. */
  price: number | null;
  clinics: ClinicRef[];
}

/** id услуги: число в локальной БД, строка в MedFlex. */
export type ServiceId = number | string;

export interface Service {
  id: ServiceId;
  name: string;
  /** Направление (med_field) — для перехода «нет направления → к какому врачу». */
  direction: string | null;
  /** Можно записаться самостоятельно, без направления. */
  selfBooking: boolean;
  /** Выполняется на приёме врача — записываться нужно к врачу. */
  atDoctorVisit: boolean;
  stationary: boolean;
  priceFrom: boolean;
  clinics: Array<ClinicRef & { price: number | null }>;
}

/** Услуга приёма врача (первичный/повторный, консультация) — определяет тип и цену визита. */
export interface VisitService {
  id: ServiceId;
  name: string;
  price: number | null;
  priceFrom: boolean;
  clinicId: number;
  clinicName: string;
}
