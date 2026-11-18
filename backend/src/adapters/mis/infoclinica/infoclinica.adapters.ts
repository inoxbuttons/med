import {
  ActionResult,
  Appointment,
  BookingOutcome,
  BookingRequest,
  Clinic,
  Doctor,
  OperatorRequestInput,
  PatientIdentity,
  Service,
  Slot,
  SlotQuery,
  VisitService,
} from '../../../core/domain';
import { BookingCapabilities, BookingPort, CatalogSourcePort } from '../../../core/ports';
import type { InfclinicaService } from '../../../integrations/infoclinica/infoclinica.service';
import type { LocalDbService } from '../../../integrations/local/local-db.service';
import { appointmentFromCancellable, doctorFromInfo, slotsFromGroups, sortSlots } from '../shared/mapping';
import { createOperatorRequest } from '../shared/operator-requests';
import { bookingComment } from '../shared/patient-comment';

/** ref записи Инфоклиники: "<SCHEDID>@<FILIAL>" — для отмены нужны оба. */
export function icRef(schedId: number, filialId: number): string {
  return `${schedId}@${filialId}`;
}

export function parseIcRef(ref: string): { schedId: number; filialId: number } | null {
  const m = /^(\d+)@(\d+)$/.exec(ref);
  return m ? { schedId: Number(m[1]), filialId: Number(m[2]) } : null;
}

/** Инфоклиника обслуживает одну сеть: все филиалы МИС считаются клиниками сети. */
export class InfoclinicaCatalogSource implements CatalogSourcePort {
  constructor(readonly clinicNetId: number, private readonly ic: InfclinicaService) {}

  clinics(): Promise<Clinic[]> {
    return this.ic.getClinics();
  }

  async doctors(): Promise<Doctor[]> {
    return (await this.ic.findDoctors('')).map(doctorFromInfo);
  }

  async services(): Promise<Service[]> {
    return [];
  }

  async searchDoctors(query: string, clinicId?: number): Promise<Doctor[]> {
    return (await this.ic.findDoctors(query, clinicId)).map(doctorFromInfo);
  }

  async searchServices(): Promise<Service[]> {
    return [];
  }
}

export class InfoclinicaBookingAdapter implements BookingPort {
  readonly mis = 'infoclinica' as const;

  constructor(
    readonly clinicNetId: number,
    private readonly ic: InfclinicaService,
    private readonly local: LocalDbService,
  ) {}

  capabilities(): BookingCapabilities {
    return {
      serviceBooking: false,
      visitServices: false,
      patientAppointments: 'client_id',
      guestBooking: true,
      guestRequiredFields: ['fullName', 'phone', 'birthday'],
      reschedule: 'cancel_then_book',
    };
  }

  async findSlots(q: SlotQuery): Promise<Slot[]> {
    if (!q.doctorId) return [];
    const groups = await this.ic.getAvailableSlots({
      doctorId: q.doctorId,
      filialId: q.clinicId,
      mode: q.mode ?? (q.date ? 'day' : 'nearest'),
      targetDate: q.date,
    });
    const slots = slotsFromGroups(groups, { doctorId: q.doctorId });
    return sortSlots(q.date && (q.mode ?? 'day') === 'day' ? slots.filter((s) => s.date === q.date) : slots);
  }

  async visitServices(): Promise<VisitService[]> {
    return [];
  }

  async book(req: BookingRequest): Promise<BookingOutcome> {
    if (!req.doctorId) {
      return { status: 'rejected', reason: 'not_supported', message: 'Запись на услуги через МИС не поддерживается.' };
    }
    const res = await this.ic.bookAppointment({
      doctorId: req.doctorId,
      clinicId: req.slot.clinicId,
      startTime: req.slot.start,
      patientId: req.patient.clientId,
      comment: bookingComment(req.patient, req.comment),
    });
    if (res.success && res.appointmentId) {
      return { status: 'booked', appointmentRef: icRef(res.appointmentId, req.slot.clinicId), message: res.message };
    }
    const m = res.message;
    return { status: 'rejected', reason: /прошедшее/.test(m) ? 'past_time' : /не найден/.test(m) ? 'not_found' : 'error', message: m };
  }

  async cancel(ref: string, patient: PatientIdentity): Promise<ActionResult> {
    const parsed = parseIcRef(ref);
    if (!parsed || !(await this.isOwn(ref, patient))) return { success: false, message: 'Запись не найдена.' };
    return this.ic.cancelAppointment(parsed.schedId, parsed.filialId);
  }

  async reschedule(ref: string, req: BookingRequest): Promise<BookingOutcome> {
    const cancelled = await this.cancel(ref, req.patient);
    if (!cancelled.success) return { status: 'rejected', reason: 'not_found', message: cancelled.message };
    const booked = await this.book(req);
    if (booked.status !== 'booked') {
      return { ...booked, message: `Старая запись отменена, но создать новую не удалось: ${booked.message}` };
    }
    return booked;
  }

  async patientAppointments(patient: PatientIdentity): Promise<Appointment[]> {
    if (!patient.clientId) return [];
    const items = await this.ic.findPatientAppointment(patient.clientId, {});
    return items.map((a) => appointmentFromCancellable(a, icRef(a.id, a.clinicId)));
  }

  createOperatorRequest(input: OperatorRequestInput) {
    return createOperatorRequest(this.local, input);
  }

  private async isOwn(ref: string, patient: PatientIdentity): Promise<boolean> {
    if (patient.sessionRefs?.includes(ref)) return true;
    return (await this.patientAppointments(patient)).some((a) => a.ref === ref);
  }
}
