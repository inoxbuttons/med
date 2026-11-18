import {
  ActionResult,
  Appointment,
  BookingOutcome,
  BookingRequest,
  OperatorRequestInput,
  PatientIdentity,
  ServiceId,
  Slot,
  SlotQuery,
  VisitService,
} from '../domain';

export type MisKind = 'local' | 'medflex' | 'infoclinica';

/**
 * Что умеет конкретная МИС. Ядро решает по этим флагам, а не по названию МИС.
 */
export interface BookingCapabilities {
  /** Запись на услуги (не только к врачам). */
  serviceBooking: boolean;
  /** Типы визита к врачу (первичный/повторный) через visitServices. */
  visitServices: boolean;
  /** Чем идентифицируется пациент для просмотра/отмены записей. */
  patientAppointments: 'client_id' | 'phone' | 'none';
  /** Гость (без авторизации) может записаться. */
  guestBooking: boolean;
  /** Какие данные пациента обязательны для записи гостя. */
  guestRequiredFields: Array<'fullName' | 'phone' | 'birthday'>;
  /** atomic — один вызов; cancel_then_book — отмена, затем запись (старая запись может пропасть при сбое). */
  reschedule: 'atomic' | 'cancel_then_book' | 'none';
}

/**
 * Единый интерфейс записи для всех МИС. Экземпляр привязан к одной сети клиник:
 * все методы работают только в пределах этой сети.
 */
export interface BookingPort {
  readonly mis: MisKind;
  readonly clinicNetId: number;

  capabilities(): BookingCapabilities;

  /** Свободные слоты, отсортированы по времени. */
  findSlots(query: SlotQuery): Promise<Slot[]>;

  /** Услуги приёма врача (первичный/повторный). Пусто, если МИС не поддерживает. */
  visitServices(doctorId: number, clinicId?: number): Promise<VisitService[]>;

  book(request: BookingRequest): Promise<BookingOutcome>;

  cancel(appointmentRef: string, patient: PatientIdentity): Promise<ActionResult>;

  reschedule(appointmentRef: string, request: BookingRequest): Promise<BookingOutcome>;

  /** Будущие записи пациента. */
  patientAppointments(patient: PatientIdentity): Promise<Appointment[]>;

  /** Заявка администратору (услуга по направлению и т. п.). */
  createOperatorRequest(input: OperatorRequestInput): Promise<ActionResult & { id: number }>;
}

/** Найти слот, совпадающий по началу — например, когда время пришло извне (MCP, кнопка). */
export async function resolveSlot(
  port: BookingPort,
  target: { doctorId?: number; serviceId?: ServiceId; clinicId?: number; start: string },
): Promise<Slot | null> {
  const start = target.start.slice(0, 16);
  const slots = await port.findSlots({
    doctorId: target.doctorId,
    serviceId: target.serviceId,
    clinicId: target.clinicId,
    mode: 'day',
    date: start.slice(0, 10),
  });
  return slots.find((s) => s.start.slice(0, 16) === start) ?? null;
}
