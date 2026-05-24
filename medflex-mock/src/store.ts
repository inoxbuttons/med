/**
 * Хранилище записей с персистентностью в JSON-файл.
 * Данные сохраняются в data/appointments.json рядом с папкой src.
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface AppointmentRecord {
  uuid: string;
  id: number;
  doctor_id: number;
  lpu_id: number;
  speciality_id: number;
  /** "YYYY-MM-DD HH:MM" */
  dt_start: string;
  /** "YYYY-MM-DD HH:MM" */
  dt_end: string;
  price: number;
  canceled: boolean;
  comment?: string;
  client: {
    first_name: string;
    last_name: string;
    second_name: string;
    mobile_phone: string;
    birthday: string;
  };
  created_at: string;
}

const DATA_FILE = path.resolve(__dirname, '../data/appointments.json');

function load(): AppointmentRecord[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw) as AppointmentRecord[];
  } catch {
    return [];
  }
}

function save(records: AppointmentRecord[]): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf8');
}

function nextSeq(records: AppointmentRecord[]): number {
  if (records.length === 0) return 1;
  return Math.max(...records.map((r) => r.id)) + 1;
}

export function createAppointment(
  data: Omit<AppointmentRecord, 'uuid' | 'id' | 'canceled' | 'created_at'>,
): AppointmentRecord {
  const records = load();
  const rec: AppointmentRecord = {
    ...data,
    uuid: randomUUID(),
    id: nextSeq(records),
    canceled: false,
    created_at: new Date().toISOString(),
  };
  records.push(rec);
  save(records);
  return rec;
}

export function cancelAppointment(uuid: string): boolean {
  const records = load();
  const rec = records.find((a) => a.uuid === uuid);
  if (!rec) return false;
  rec.canceled = true;
  save(records);
  return true;
}

/**
 * Канонизирует dt_start к "YYYY-MM-DD HH:MM" — нужно для сравнения,
 * т.к. в данных встречаются оба формата (T-сепаратор и пробел, с секундами и без).
 */
function normalizeDt(s: string): string {
  return s.replace('T', ' ').slice(0, 16);
}

/** Проверяет, занят ли слот у данного врача в данной клинике. */
export function isSlotBooked(doctorId: number, lpuId: number, dtStart: string): boolean {
  const target = normalizeDt(dtStart);
  return load().some(
    (a) =>
      !a.canceled &&
      a.doctor_id === doctorId &&
      a.lpu_id === lpuId &&
      normalizeDt(a.dt_start) === target,
  );
}

/** Возвращает записи с фильтрацией. */
export function getHistory(params: {
  mobilePhone?: string;
  lpuId?: number;
  doctorId?: number;
  dateStart?: string;
  dateEnd?: string;
  uuid?: string;
  includeCanceled?: boolean;
}): AppointmentRecord[] {
  return load().filter((a) => {
    if (!params.includeCanceled && a.canceled) return false;
    if (params.uuid && a.uuid !== params.uuid) return false;
    if (params.mobilePhone && a.client.mobile_phone !== params.mobilePhone) return false;
    if (params.lpuId && a.lpu_id !== params.lpuId) return false;
    if (params.doctorId && a.doctor_id !== params.doctorId) return false;
    const date = a.dt_start.slice(0, 10);
    if (params.dateStart && date < params.dateStart) return false;
    if (params.dateEnd && date > params.dateEnd) return false;
    return true;
  });
}

/** Все активные записи (для исключения занятых слотов из расписания). */
export function getActiveAppointments(): AppointmentRecord[] {
  return load().filter((a) => !a.canceled);
}
