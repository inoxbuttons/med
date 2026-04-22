/**
 * Типы данных API MedFlex.
 *
 * TODO: заполнить на основе документации MedFlex API.
 * Пока содержит плейсхолдеры, отражающие предполагаемую структуру.
 */

// ── Конфигурация ─────────────────────────────────────────────────────────────

export interface MedflexConfig {
  /** Базовый URL API MedFlex */
  apiUrl: string;
  /** API-ключ клиники (хранится в clinic_nets.medflex_key) */
  apiKey: string;
}

// ── Заглушки типов ответов ────────────────────────────────────────────────────
// Будут уточнены после получения документации API MedFlex.

export interface MfClinic {
  id: number;
  name: string;
  address?: string;
  phone?: string;
}

export interface MfDoctor {
  id: number;
  name: string;
  speciality: string;
  clinicId: number;
  clinicName: string;
  price?: number;
}

export interface MfSlot {
  id: string;
  doctorId: number;
  clinicId: number;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
  isFree: boolean;
}

export interface MfBookingRequest {
  doctorId: number;
  clinicId: number;
  date: string;    // YYYY-MM-DD
  time: string;    // HH:MM
  patientComment?: string;
}

export interface MfBookingResult {
  success: boolean;
  appointmentId?: string;
  message: string;
}

export interface MfCancelResult {
  success: boolean;
  message: string;
}

// ── Контракт клиента ──────────────────────────────────────────────────────────

export interface IMedflexClient {
  getClinics(): Promise<MfClinic[]>;
  getDoctors(speciality?: string, clinicId?: number): Promise<MfDoctor[]>;
  getSlots(doctorId: number, fromDate: string, toDate: string, clinicId?: number): Promise<MfSlot[]>;
  bookAppointment(request: MfBookingRequest): Promise<MfBookingResult>;
  cancelAppointment(appointmentId: string): Promise<MfCancelResult>;
}
