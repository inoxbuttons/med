import {
  ActionResult,
  Appointment,
  BookingOutcome,
  BookingRequest,
  OperatorRequestInput,
  PatientIdentity,
  Slot,
  SlotQuery,
  VisitService,
} from '../../../core/domain';
import { BookingCapabilities, BookingPort } from '../../../core/ports';
import type { LocalDbService } from '../../../integrations/local/local-db.service';
import type { MedflexService } from '../../../integrations/medflex/medflex.service';
import type { MfDoctor } from '../../../integrations/medflex/medflex.types';
import { isMissingBirthday, isMissingPhone, isPlaceholderValue } from '../../../integrations/shared/patient-data-utils';
import { slotsFromGroups, sortSlots } from '../shared/mapping';
import { createOperatorRequest } from '../shared/operator-requests';
import { MedflexCatalogSource, MedflexNetContext } from './medflex-catalog.source';

/** Данные слота MedFlex, нужные для записи. Хранятся в Slot.ref. */
interface MfSlotRef {
  dtStart: string;
  dtEnd: string;
  specialityId: number | null;
  price: number | null;
}

export function encodeMfRef(r: MfSlotRef): string {
  return JSON.stringify(r);
}

export function decodeMfRef(ref?: string): MfSlotRef | null {
  if (!ref) return null;
  try {
    const r = JSON.parse(ref);
    return typeof r?.dtStart === 'string' && typeof r?.dtEnd === 'string' ? r : null;
  } catch {
    return null;
  }
}

/**
 * Запись через MedFlex. Особенности МИС (dt_start/dt_end, specialityId, цена, uuid записей,
 * идентификация пациента по телефону) скрыты здесь — ядро видит только доменные типы.
 */
export class MedflexBookingAdapter implements BookingPort {
  readonly mis = 'medflex' as const;

  constructor(
    readonly clinicNetId: number,
    private readonly mf: MedflexService,
    private readonly local: LocalDbService,
    private readonly ctx: MedflexNetContext,
    private readonly catalog: MedflexCatalogSource,
  ) {}

  capabilities(): BookingCapabilities {
    return {
      serviceBooking: true,
      visitServices: false,
      patientAppointments: 'phone',
      guestBooking: true,
      guestRequiredFields: ['fullName', 'phone', 'birthday'],
      reschedule: 'cancel_then_book',
    };
  }

  async findSlots(q: SlotQuery): Promise<Slot[]> {
    if (q.clinicId && !(await this.catalog.inNet(q.clinicId))) return [];
    if (q.doctorId) {
      const [doc] = await this.catalog.rawDoctors([q.doctorId]);
      if (!doc) return [];
      const specialityId = doc.specialities[0] ?? null;
      const price = doc.prices?.find((p) => p.speciality_id === specialityId)?.price ?? null;
      return this.doctorSlots(doc, q, { specialityId, price });
    }
    if (q.serviceId !== undefined) {
      const sid = String(q.serviceId);
      const perLpu = await this.catalog.rawServices();
      const out: Slot[] = [];
      for (const { lpuId, services } of perLpu) {
        if (q.clinicId && lpuId !== q.clinicId) continue;
        const svc = services.find((s) => s.id === sid);
        if (!svc || svc.doctor_ids.length === 0) continue;
        const docs = await this.catalog.rawDoctors(svc.doctor_ids);
        for (const doc of docs) {
          if (!doc.lpus.includes(lpuId)) continue;
          const slots = await this.doctorSlots(doc, { ...q, clinicId: lpuId }, {
            specialityId: doc.specialities[0] ?? null,
            price: svc.price ?? null,
          });
          out.push(...slots.map((s) => ({ ...s, serviceId: q.serviceId })));
        }
      }
      return sortSlots(out);
    }
    return [];
  }

  async visitServices(_doctorId: number, _clinicId?: number): Promise<VisitService[]> {
    return [];
  }

  async book(req: BookingRequest): Promise<BookingOutcome> {
    const ref = decodeMfRef(req.slot.ref);
    const doctorId = req.doctorId ?? req.slot.doctorId;
    if (!ref || !doctorId) {
      return { status: 'rejected', reason: 'not_found', message: 'Слот не найден. Выберите время из списка.' };
    }
    if (!(await this.catalog.inNet(req.slot.clinicId))) {
      return { status: 'rejected', reason: 'outside_net', message: 'Клиника не входит в сеть.' };
    }
    const missing = missingPatientFields(req.patient);
    if (missing.length > 0) {
      return {
        status: 'rejected',
        reason: 'patient_data_required',
        missing,
        message: `Для записи нужны данные пациента: ${missing.join(', ')}.`,
      };
    }
    const p = req.patient.data!;
    try {
      const res = await this.mf.bookAppointment(this.ctx.client, {
        doctorId,
        clinicId: req.slot.clinicId,
        specialityId: ref.specialityId as number,
        startTime: ref.dtStart,
        endTime: ref.dtEnd,
        price: ref.price ?? 0,
        firstName: p.firstName,
        lastName: p.lastName,
        secondName: p.secondName,
        phone: p.phone,
        birthday: p.birthday,
        comment: req.comment,
      });
      if (res.success && res.uuid) return { status: 'booked', appointmentRef: res.uuid, message: res.message };
      return { status: 'rejected', reason: /прошедшее/.test(res.message) ? 'past_time' : 'invalid_patient_data', message: res.message };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes('409')) {
        const existing = await this.mf.findConflictingAppointment(this.ctx.client, p.phone, ref.dtStart);
        return {
          status: 'conflict',
          existingRef: existing?.uuid ?? null,
          description: existing?.description ?? null,
          message: existing ? `У Вас уже есть запись на это время: ${existing.description}.` : 'У Вас уже есть запись на это время.',
        };
      }
      return mapMfError(msg);
    }
  }

  async cancel(ref: string, patient: PatientIdentity): Promise<ActionResult> {
    if (!(await this.isOwn(ref, patient))) return { success: false, message: 'Запись не найдена.' };
    try {
      return await this.mf.cancelAppointment(this.ctx.client, ref);
    } catch (err: any) {
      return { success: false, message: mapMfError(String(err?.message ?? err)).message };
    }
  }

  async reschedule(ref: string, req: BookingRequest): Promise<BookingOutcome> {
    if (!(await this.isOwn(ref, req.patient))) {
      return { status: 'rejected', reason: 'not_found', message: 'Запись не найдена.' };
    }
    const cancelled = await this.cancel(ref, req.patient);
    if (!cancelled.success) return { status: 'rejected', reason: 'error', message: `Не удалось отменить старую запись: ${cancelled.message}` };
    const booked = await this.book(req);
    if (booked.status !== 'booked') {
      return { ...booked, message: `Старая запись отменена, но создать новую не удалось: ${booked.message}` };
    }
    return booked;
  }

  async patientAppointments(patient: PatientIdentity): Promise<Appointment[]> {
    const phone = patient.data?.phone;
    if (!phone) return [];
    const items = await this.mf.getPatientAppointments(this.ctx.client, phone, this.ctx.lpuGroupId);
    return items
      .filter((a) => !a.canceled)
      .map((a) => ({
        ref: a.uuid,
        kind: 'doctor' as const,
        date: a.date,
        time: a.time,
        clinicId: null,
        clinicName: a.clinicName,
        doctorName: a.doctorName,
        speciality: a.speciality,
      }));
  }

  createOperatorRequest(input: OperatorRequestInput) {
    return createOperatorRequest(this.local, input);
  }

  private async isOwn(ref: string, patient: PatientIdentity): Promise<boolean> {
    if (patient.sessionRefs?.includes(ref)) return true;
    return (await this.patientAppointments(patient)).some((a) => a.ref === ref);
  }

  private async doctorSlots(
    doc: MfDoctor,
    q: SlotQuery,
    booking: { specialityId: number | null; price: number | null },
  ): Promise<Slot[]> {
    const clinicIds = q.clinicId ? [q.clinicId] : doc.lpus;
    const netIds = await this.catalog.clinicIds();
    const out: Slot[] = [];
    for (const clinicId of clinicIds) {
      if (!netIds.includes(clinicId)) continue;
      const groups = await this.mf.getAvailableSlots(this.ctx.client, {
        doctorId: doc.id,
        clinicId,
        lpuGroupId: this.ctx.lpuGroupId,
        mode: q.mode ?? (q.date ? 'day' : 'nearest'),
        targetDate: q.date,
        townId: this.ctx.townId,
      });
      for (const g of groups) {
        const slots = slotsFromGroups([g], { doctorId: doc.id, doctorName: doc.efio });
        // times и dtSlots в группе идут в одном порядке; slotsFromGroups сортирует — сопоставляем по времени.
        const dtByTime = new Map(g.times.map((t, i) => [t, g.dtSlots[i]]));
        for (const s of slots) {
          const dt = dtByTime.get(s.time);
          if (!dt) continue;
          out.push({
            ...s,
            end: `${dt.dt_end.replace(' ', 'T').slice(0, 16)}:00`,
            ref: encodeMfRef({ dtStart: dt.dt_start, dtEnd: dt.dt_end, ...booking }),
          });
        }
      }
    }
    return sortSlots(out);
  }
}

function missingPatientFields(patient: PatientIdentity): string[] {
  const d = patient.data;
  const missing: string[] = [];
  if (!d || isPlaceholderValue(d.lastName)) missing.push('фамилия');
  if (!d || isPlaceholderValue(d.firstName)) missing.push('имя');
  if (!d || isMissingPhone(d.phone)) missing.push('телефон');
  if (!d || isMissingBirthday(d.birthday)) missing.push('дата рождения');
  return missing;
}

function mapMfError(msg: string): BookingOutcome & { status: 'rejected' } {
  if (msg.includes('423')) return { status: 'rejected', reason: 'slot_taken', message: 'Выбранный слот уже занят. Пожалуйста, выберите другое время.' };
  if (msg.includes('400')) return { status: 'rejected', reason: 'error', message: 'Запись не удалась. Возможно, слот недоступен.' };
  if (msg.includes('401')) return { status: 'rejected', reason: 'error', message: 'Ошибка авторизации MedFlex. Обратитесь к администратору.' };
  if (msg.includes('429')) return { status: 'rejected', reason: 'error', message: 'Превышен лимит запросов. Подождите минуту и повторите.' };
  return { status: 'rejected', reason: 'error', message: 'Не удалось выполнить запрос к МИС.' };
}
