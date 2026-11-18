import { ServiceId } from './catalog';

export type SlotMode = 'nearest' | 'day' | 'week';

export interface SlotQuery {
  doctorId?: number;
  serviceId?: ServiceId;
  clinicId?: number;
  /** nearest — ближайший день со слотами; day — конкретный день; week — две недели от date. */
  mode?: SlotMode;
  /** YYYY-MM-DD; обязателен для mode=day. */
  date?: string;
}

/**
 * Один свободный слот. Время — локальное время клиники, без зоны.
 * `ref` — непрозрачные данные адаптера (например, dt_start/dt_end и specialityId MedFlex),
 * ядро передаёт его обратно в BookingPort.book без разбора.
 */
export interface Slot {
  /** YYYY-MM-DDTHH:MM:00 */
  start: string;
  end: string | null;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  /** «Сегодня» / «Завтра» / «Вторник, 26 мая» */
  dateLabel: string;
  clinicId: number;
  clinicName: string;
  doctorId?: number;
  doctorName?: string;
  serviceId?: ServiceId;
  ref?: string;
}
