/**
 * Адаптер: преобразует типы Инфоклиника в внутренние типы BookingService.
 */

import {
  ClinicInfo,
  DoctorInfo,
  SlotGroup,
  BookingResult,
  PatientAppointmentItem,
  CancellableAppointment,
} from '../../booking/booking.service';
import { IcFilial, IcDoctor, IcFreeSlot, IcBookingResult } from './infoclinica.types';

// ── Дата / время ─────────────────────────────────────────────────────────────

/** YYYYMMDD → YYYY-MM-DD */
export function icDateToIso(icDate: string): string {
  return `${icDate.slice(0, 4)}-${icDate.slice(4, 6)}-${icDate.slice(6, 8)}`;
}

/** YYYY-MM-DD → YYYYMMDD */
export function isoToIcDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

const DAY_NAMES = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

// ── Справочники ───────────────────────────────────────────────────────────────

export function toClinics(filials: IcFilial[]): ClinicInfo[] {
  return filials.map((f) => ({
    id: f.FILIAL,
    name: f.FNAME,
    address: f.FADDRESS ?? null,
    phone: f.FPHONE ?? null,
  }));
}

export function toDoctors(icDoctors: IcDoctor[]): DoctorInfo[] {
  const map = new Map<number, DoctorInfo>();
  for (const d of icDoctors) {
    if (!map.has(d.DCODE)) {
      map.set(d.DCODE, {
        id: d.DCODE,
        name: d.DNAME,
        speciality: d.DEPNAME,
        price: d.PRICE ?? null,
        clinics: [],
      });
    }
    const existing = map.get(d.DCODE)!;
    if (!existing.clinics.some((c) => c.id === d.FILIAL)) {
      existing.clinics.push({ id: d.FILIAL, name: d.FNAME });
    }
  }
  return [...map.values()];
}

// ── Слоты ─────────────────────────────────────────────────────────────────────

export function toSlotGroups(
  slots: IcFreeSlot[],
  filials: IcFilial[],
  mode: 'nearest' | 'day' | 'week',
): SlotGroup[] {
  // Только свободные слоты
  const free = slots.filter((s) => s.FREETYPE === 0);

  // Группируем по дате + филиал
  const groups = new Map<string, SlotGroup>();
  for (const s of free) {
    const key = `${s.WDATE}_${s.FILIAL}`;
    if (!groups.has(key)) {
      const isoDate = icDateToIso(s.WDATE);
      const d = new Date(`${isoDate}T00:00:00`);
      const jsDay = d.getDay();
      const dbDay = jsDay === 0 ? 7 : jsDay;
      const filial = filials.find((f) => f.FILIAL === s.FILIAL);
      groups.set(key, {
        date: isoDate,
        dayName: DAY_NAMES[dbDay],
        clinicId: s.FILIAL,
        clinicName: filial?.FNAME ?? `Филиал ${s.FILIAL}`,
        times: [],
      });
    }
    const t = `${String(s.BHOUR).padStart(2, '0')}:${String(s.BMIN).padStart(2, '0')}`;
    groups.get(key)!.times.push(t);
  }

  const sorted = [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));

  if (mode === 'nearest') {
    if (sorted.length === 0) return [];
    return [{ ...sorted[0], times: sorted[0].times.slice(0, 5) }];
  }
  return sorted;
}

// ── Запись ────────────────────────────────────────────────────────────────────

export function toBookingResult(icResult: IcBookingResult, successMessage?: string): BookingResult {
  if (icResult.SPRESULT === 1) {
    return {
      success: true,
      appointmentId: icResult.SCHEDID,
      message: successMessage ?? icResult.SPCOMMENT ?? 'Запись подтверждена!',
    };
  }
  return {
    success: false,
    message: icResult.CHECKTEXT ?? icResult.SPCOMMENT ?? 'Ошибка при записи',
  };
}

// ── Записи пациента ───────────────────────────────────────────────────────────

export interface IcStoredAppointment {
  id: number; // = SCHEDID из Инфоклиники
  filialId: number;
  doctorCode: number;
  doctorName: string;
  clinicName: string;
  depName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  patientId?: number;
}

export function toPatientAppointmentItem(a: IcStoredAppointment): PatientAppointmentItem {
  return {
    type: 'doctor',
    date: a.date,
    time: a.time,
    clinicName: a.clinicName,
    doctorName: a.doctorName,
    speciality: a.depName,
  };
}

export function toCancellableAppointment(a: IcStoredAppointment): CancellableAppointment {
  return {
    id: a.id,
    type: 'doctor',
    date: a.date,
    time: a.time,
    clinicId: a.filialId,
    clinicName: a.clinicName,
    doctorId: a.doctorCode,
    doctorName: a.doctorName,
    speciality: a.depName,
  };
}
