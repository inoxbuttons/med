import { ServiceId } from './catalog';
import { PatientIdentity } from './patient';
import { Slot } from './slot';

/** Существующая запись пациента. `ref` — непрозрачный идентификатор адаптера (id, uuid, schedId@filial). */
export interface Appointment {
  ref: string;
  kind: 'doctor' | 'service';
  date: string;
  time: string;
  clinicId: number | null;
  clinicName: string;
  doctorId?: number;
  doctorName?: string;
  speciality?: string;
  serviceId?: ServiceId;
  serviceName?: string;
}

export interface BookingRequest {
  /** Слот из BookingPort.findSlots того же адаптера. */
  slot: Slot;
  /** Запись к врачу. */
  doctorId?: number;
  /** Запись на услугу (без doctorId). */
  serviceId?: ServiceId;
  /** Тип визита к врачу (первичный/повторный) — услуга из BookingPort.visitServices. */
  visitServiceId?: ServiceId;
  patient: PatientIdentity;
  comment?: string;
}

export type BookingRejectReason =
  | 'past_time'
  | 'not_found'
  | 'slot_taken'
  | 'outside_net'
  | 'patient_data_required'
  | 'invalid_patient_data'
  | 'not_supported'
  | 'error';

export type BookingOutcome =
  | { status: 'booked'; appointmentRef: string; message: string }
  /**
   * У пациента уже есть запись на это время. existingRef/description — что именно
   * (если удалось найти): ref годится для cancel/reschedule того же адаптера.
   */
  | { status: 'conflict'; existingRef: string | null; description: string | null; message: string }
  | { status: 'rejected'; reason: BookingRejectReason; message: string; missing?: string[] };

export interface OperatorRequestInput {
  clinicId?: number;
  serviceId?: ServiceId;
  doctorId?: number;
  patient: PatientIdentity;
  notes?: string;
  sessionId?: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
}
