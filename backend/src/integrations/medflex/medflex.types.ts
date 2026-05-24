/**
 * Типы данных API MedFlex (Открытый токен клиники).
 * Документация: https://developer.medflex.ru/leadgeneration/
 * Сервер: https://api.medflex.ru
 * Авторизация: Token {apiKey} (header Authorization)
 *
 * Версии:
 *   v1 — clinics (lpu), doctors, specialities, schedule/lpu/, direct_appointment/
 *   v2 — schedule/ (с town_id), towns, districts, metro
 */

// ── Пагинация ─────────────────────────────────────────────────────────────────

export interface MfPage<T> {
  count: number;
  num_pages: number;
  links: { next: string | null; previous: string | null };
  data: T[];
}

// ── Справочники ───────────────────────────────────────────────────────────────

export interface MfSpeciality {
  id: number;
  name: string;
}

export interface MfLpu {
  id: number;
  lpu_group_id: number | null;
  name: string;
  address: string;
  phone?: string;
  town_id: number;
  town_name?: string;
  district_id?: number;
  lon?: number;
  lat?: number;
  direct_appointment_is_supported: boolean;
  cancel_appointment_is_supported: boolean;
  is_visible: boolean;
  specialities: number[];
}

export interface MfDoctorPrice {
  lpu_id?: number;
  speciality_id: number;
  price: number | null;
}

export interface MfDoctor {
  id: number;
  efio: string;
  specialities: number[];
  lpus: number[];
  prices?: MfDoctorPrice[];
  rating?: { stars: number; public: number };
}

// ── Расписание ────────────────────────────────────────────────────────────────

/** Слот расписания: формат "YYYY-MM-DD HH:MM" */
export interface MfCell {
  dt_start: string;
  dt_end: string;
}

export interface MfDoctorSchedule {
  doctor_id: number;
  prices: { speciality_id: number; price: number | null }[];
  allowed_age: { speciality_id: number; min: number; max: number }[];
  cells: MfCell[];
}

export interface MfLpuSchedule {
  lpu_id: number;
  schedule: MfDoctorSchedule[];
}

// ── Запись ────────────────────────────────────────────────────────────────────

export interface MfBookingRequest {
  doctor: {
    id: number;
    lpu_id: number;
    speciality_id: number;
  };
  appointment: {
    dt_start: string;  // ISO date-time
    dt_end: string;    // ISO date-time
    price: number;
    comment?: string;
  };
  client: {
    first_name: string;
    last_name: string;
    second_name: string;   // отчество, обязательно (пустая строка если нет)
    mobile_phone: string;  // 79000000000
    birthday: string;      // YYYY-MM-DD
  };
}

export interface MfBookingResponse {
  claim_id: string;  // UUID созданной записи
}

export interface MfCancelRequest {
  uuid: string;
}

// ── История записей ───────────────────────────────────────────────────────────

export interface MfAppointmentHistory {
  id: number;
  uuid: string;
  date: string;
  time_start: string;
  time_end: string;
  price: number;
  canceled: boolean;
  lpu: { id: number; name: string; address: string };
  doctor: { id: number; fio: string; speciality_id: number; speciality_name: string };
  patient: {
    mobile_phone: string;
    first_name: string;
    second_name: string;
    last_name: string;
    birthday: string;
  };
}

// ── Услуги (per /services/categories/ и /services/prices/) ──────────────────
// В отличие от specialities (квалификация врача), services — конкретные процедуры
// (УЗИ сердца, пилинг, и т.д.). Связаны с врачами через doctor_ids. Бронирование
// идёт по специальности врача (`/direct_appointment/doctor/execute/`), но цена
// в appointment.price для процедуры берётся из service.price.

export interface MfServiceCategory {
  id: number;
  name: string;
}

export interface MfService {
  /** ID услуги — строка по спеке MedFlex (пример из спеки: "8038"). */
  id: string;
  category_id: number;
  name: string;
  /** Длительность в минутах; может быть null (для лабораторных, например). */
  duration: number | null;
  price: number;
  /** ID врачей, выполняющих эту услугу. Может быть пустым. */
  doctor_ids: number[];
}

/** Обёртка ответа `/services/categories/`: data вложен под `lpu_id` + `categories`. */
export interface MfServiceCategoriesResponse {
  count: number;
  num_pages: number;
  links: { next: string | null; previous: string | null };
  data: { lpu_id: number; categories: MfServiceCategory[] };
}

/** Обёртка ответа `/services/prices/`: data вложен под `lpu_id` + `services`. */
export interface MfServicePricesResponse {
  count: number;
  num_pages: number;
  links: { next: string | null; previous: string | null };
  data: { lpu_id: number; services: MfService[] };
}

// ── Географические модели (v2, для будущей геофильтрации) ────────────────────

export interface MfTown {
  id: number;
  name: string;
  region_id?: number;
}

export interface MfDistrict {
  id: number;
  name: string;
  town_id: number;
}
