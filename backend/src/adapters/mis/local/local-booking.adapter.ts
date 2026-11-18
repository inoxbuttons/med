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
import { appointmentFromCancellable, slotsFromGroups } from '../shared/mapping';
import { createOperatorRequest } from '../shared/operator-requests';
import { bookingComment } from '../shared/patient-comment';
import { LocalCatalogSource } from './local-catalog.source';

/** ref записи в локальной БД: "doctor:12" / "service:34". */
export function localRef(kind: 'doctor' | 'service', id: number): string {
  return `${kind}:${id}`;
}

export function parseLocalRef(ref: string): { kind: 'doctor' | 'service'; id: number } | null {
  const m = /^(doctor|service):(\d+)$/.exec(ref);
  return m ? { kind: m[1] as 'doctor' | 'service', id: Number(m[2]) } : null;
}

/**
 * Запись через собственную БД (сети без внешней МИС).
 * Делегирует в LocalDbService; добавляет ограничение сетью и доменные типы.
 */
export class LocalBookingAdapter implements BookingPort {
  readonly mis = 'local' as const;

  constructor(
    readonly clinicNetId: number,
    private readonly local: LocalDbService,
    private readonly catalog: LocalCatalogSource,
  ) {}

  capabilities(): BookingCapabilities {
    return {
      serviceBooking: true,
      visitServices: true,
      patientAppointments: 'client_id',
      guestBooking: true,
      guestRequiredFields: ['fullName', 'phone', 'birthday'],
      reschedule: 'atomic',
    };
  }

  async findSlots(q: SlotQuery): Promise<Slot[]> {
    if (!q.doctorId && q.serviceId === undefined) return [];
    if (q.clinicId && !(await this.catalog.inNet(q.clinicId))) return [];

    const serviceId = q.serviceId !== undefined ? Number(q.serviceId) : undefined;
    const groups = await this.local.getAvailableSlots({
      doctorId: q.doctorId,
      serviceId: q.doctorId ? undefined : serviceId,
      clinicId: q.clinicId,
      mode: q.mode ?? (q.date ? 'day' : 'nearest'),
      targetDate: q.date,
    });
    const netIds = await this.catalog.clinicIds();
    const inNet = groups.filter((g) => netIds.has(g.clinicId));
    if (!q.doctorId) return slotsFromGroups(inNet, { serviceId });
    return slotsFromGroups(inNet, { doctorId: q.doctorId, doctorName: await this.catalog.doctorName(q.doctorId) });
  }

  async visitServices(doctorId: number, clinicId?: number): Promise<VisitService[]> {
    return this.local.findDoctorConsultationServices(doctorId, clinicId, this.clinicNetId);
  }

  async book(req: BookingRequest): Promise<BookingOutcome> {
    const { slot } = req;
    if (!(await this.catalog.inNet(slot.clinicId))) {
      return { status: 'rejected', reason: 'outside_net', message: 'Клиника не входит в сеть.' };
    }
    if (!req.doctorId && req.serviceId === undefined) {
      return { status: 'rejected', reason: 'not_found', message: 'Не указан врач или услуга.' };
    }

    const clientId = req.patient.clientId;
    if (clientId) {
      const c = await this.local.checkPatientTimeConflict(clientId, slot.start);
      if (c) {
        return {
          status: 'conflict',
          existingRef: localRef(c.type, c.id),
          description: c.description,
          message: `У Вас уже есть запись на это время: ${c.description}.`,
        };
      }
    }

    // Запись к врачу — без serviceId: LocalDbService.bookAppointment с serviceId
    // создаёт запись на услугу (service_appointments) и теряет врача.
    // Тип приёма сохраняем в комментарии.
    const visit = req.doctorId && req.visitServiceId !== undefined
      ? `Тип приёма: услуга #${req.visitServiceId}`
      : undefined;
    const res = await this.local.bookAppointment({
      doctorId: req.doctorId,
      serviceId: req.doctorId ? undefined : Number(req.serviceId),
      clinicId: slot.clinicId,
      startTime: slot.start,
      patientId: clientId,
      comment: bookingComment(req.patient, req.comment, visit),
    });
    return this.outcome(res, req.doctorId ? 'doctor' : 'service');
  }

  async cancel(ref: string, patient: PatientIdentity): Promise<ActionResult> {
    const own = await this.findOwn(ref, patient);
    if (!own) return { success: false, message: 'Запись не найдена.' };
    return this.local.cancelAppointment(own.id, own.kind);
  }

  async reschedule(ref: string, req: BookingRequest): Promise<BookingOutcome> {
    const own = await this.findOwn(ref, req.patient);
    if (!own) return { status: 'rejected', reason: 'not_found', message: 'Запись не найдена.' };
    if (!(await this.catalog.inNet(req.slot.clinicId))) {
      return { status: 'rejected', reason: 'outside_net', message: 'Клиника не входит в сеть.' };
    }
    const res = await this.local.rescheduleAppointment({
      oldId: own.id,
      type: own.kind,
      doctorId: req.doctorId,
      serviceId: req.doctorId ? undefined : Number(req.serviceId),
      clinicId: req.slot.clinicId,
      newStartTime: req.slot.start,
      patientId: req.patient.clientId,
      comment: req.comment,
    });
    return this.outcome(res, req.doctorId ? 'doctor' : 'service');
  }

  async patientAppointments(patient: PatientIdentity): Promise<Appointment[]> {
    if (!patient.clientId) return [];
    const items = await this.local.findPatientAppointment(patient.clientId, {});
    const netIds = await this.catalog.clinicIds();
    return items
      .filter((a) => netIds.has(a.clinicId))
      .map((a) => appointmentFromCancellable(a, localRef(a.type, a.id)));
  }

  createOperatorRequest(input: OperatorRequestInput) {
    return createOperatorRequest(this.local, input);
  }

  /** Запись принадлежит пациенту и сети — иначе отменять/переносить нельзя. */
  private async findOwn(ref: string, patient: PatientIdentity) {
    const parsed = parseLocalRef(ref);
    if (!parsed || !patient.clientId) return null;
    const mine = await this.patientAppointments(patient);
    return mine.some((a) => a.ref === ref) ? parsed : null;
  }

  private outcome(
    res: { success: boolean; appointmentId?: number; message: string },
    kind: 'doctor' | 'service',
  ): BookingOutcome {
    if (res.success && res.appointmentId) {
      return { status: 'booked', appointmentRef: localRef(kind, res.appointmentId), message: res.message };
    }
    const m = res.message;
    const reason = /прошедшее/.test(m) ? 'past_time' : /занято/.test(m) ? 'slot_taken' : /не найден/.test(m) ? 'not_found' : 'error';
    return { status: 'rejected', reason, message: m };
  }
}
