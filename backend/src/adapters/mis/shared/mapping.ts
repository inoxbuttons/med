import { Appointment, Doctor, ServiceId, Slot } from '../../../core/domain';
import type {
  CancellableAppointment,
  DoctorInfo,
  SlotGroup,
} from '../../../integrations/local/local-db.service';

/** Разворачивает группы «день → времена» в плоский список слотов. */
export function slotsFromGroups(
  groups: SlotGroup[],
  extra: { doctorId?: number; doctorName?: string; serviceId?: ServiceId } = {},
): Slot[] {
  const slots: Slot[] = [];
  for (const g of groups) {
    for (const time of g.times) {
      slots.push({
        start: `${g.date}T${time}:00`,
        end: null,
        date: g.date,
        time,
        dateLabel: g.dateLabel,
        clinicId: g.clinicId,
        clinicName: g.clinicName,
        ...extra,
      });
    }
  }
  return sortSlots(slots);
}

export function sortSlots(slots: Slot[]): Slot[] {
  return slots.sort((a, b) => a.start.localeCompare(b.start) || a.clinicId - b.clinicId);
}

export function doctorFromInfo(d: DoctorInfo & { specialityId?: number | null }): Doctor {
  return {
    id: d.id,
    name: d.name,
    speciality: d.speciality,
    specialityId: d.specialityId ?? null,
    price: d.price,
    clinics: d.clinics,
  };
}

export function appointmentFromCancellable(a: CancellableAppointment, ref: string): Appointment {
  return {
    ref,
    kind: a.type,
    date: a.date,
    time: a.time,
    clinicId: a.clinicId ?? null,
    clinicName: a.clinicName,
    doctorId: a.doctorId,
    doctorName: a.doctorName,
    speciality: a.speciality,
    serviceId: a.serviceId,
    serviceName: a.serviceName,
  };
}

/** Короткий кеш на время жизни адаптера (один запрос / одна сессия). */
export class Memo<T> {
  private value: Promise<T> | null = null;
  constructor(private readonly load: () => Promise<T>) {}
  get(): Promise<T> {
    if (!this.value) {
      this.value = this.load().catch((err) => {
        this.value = null;
        throw err;
      });
    }
    return this.value;
  }
}
