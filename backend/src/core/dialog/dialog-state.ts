import { Appointment, PatientData, ServiceId, Slot, VisitService } from '../domain';
import { Frame, FrameEntities, Goal } from '../nlu/frame';
import { Expectation } from '../nlu/rule-parser';

/** Кого/что ищем: врач, группа врачей одной специальности или услуга. */
export type Target =
  | { kind: 'doctor'; doctorId: number; name: string; speciality?: string }
  | { kind: 'speciality'; title: string; doctorIds: number[] }
  | {
      kind: 'service';
      serviceId: ServiceId;
      name: string;
      selfBooking: boolean;
      atDoctorVisit: boolean;
      direction: string | null;
      clinics: Array<{ id: number; name: string; price: number | null }>;
      priceFrom: boolean;
    };

/** Вариант в показанном списке — что выбрал пациент. */
export type Option =
  | { kind: 'target'; target: Target; label: string }
  | { kind: 'slot'; slot: Slot; label: string }
  | { kind: 'appointment'; appointment: Appointment; label: string }
  | { kind: 'visit'; visit: VisitService; label: string }
  | { kind: 'action'; action: 'replace' | 'keep_both' | 'other_time'; label: string }
  | { kind: 'area'; targets: Target[]; aliases: string[]; label: string };

export interface DialogState {
  goal: Goal | null;
  /** Накопленные ограничения из реплик. */
  entities: FrameEntities;
  target?: Target;
  slot?: Slot;
  visit?: VisitService | null;
  /** Существующая запись (отмена/перенос/конфликт). */
  appointment?: Appointment;
  /** Конфликт при записи: ref существующей записи. */
  conflictRef?: string | null;
  /** Направление: undefined — не спрашивали. */
  hasReferral?: boolean;
  options: Option[];
  expectation: Expectation;
  /** Очередь следующих целей из той же реплики. */
  queue: Frame[];
  /** Ответ на вопрос ведёт к записи: «Записать?» → да. */
  offerBooking?: boolean;
  /** Перенос «на другой день» — не предлагать эту дату. */
  excludeDate?: string;
}

export interface DialogSession {
  id: string;
  clinicNetId: number;
  clientId?: number;
  townId?: number;
  districtId?: number;
  patient?: PatientData;
  provider: import('../../chat/chat.types').LlmProvider;
  model?: string;
  state: DialogState;
  /** Записи, сделанные в этом диалоге (гость может отменить/перенести без входа). */
  booked?: Appointment[];
  /** История для клиента и для короткого контекста NLU. */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  updatedAt: number;
}

export function emptyState(): DialogState {
  return { goal: null, entities: {}, options: [], expectation: { kind: 'none' }, queue: [] };
}

/** Поля, зависящие от ограничения: поменялся день — слот недействителен и т. п. */
export function invalidate(state: DialogState, changed: Array<keyof FrameEntities | string>): void {
  const has = (...keys: string[]) => keys.some((k) => changed.includes(k));
  if (has('doctorName', 'speciality', 'serviceQuery', 'symptom', 'child')) {
    state.target = undefined;
    state.visit = undefined;
    state.hasReferral = undefined;
  }
  if (has('doctorName', 'speciality', 'serviceQuery', 'symptom', 'child', 'date', 'dayOfWeek', 'relativeDay', 'nextWeek', 'time', 'timeOfDay', 'now', 'clinic')) {
    state.slot = undefined;
  }
  if (has('visitType')) state.visit = undefined;
}

/** Краткое описание состояния для NLU (без персональных данных). */
export function summarize(state: DialogState): string {
  if (!state.goal) return 'нет активной цели';
  const parts: string[] = [goalLabel(state.goal)];
  if (state.target) parts.push(state.target.kind === 'service' ? `услуга: ${state.target.name}` : state.target.kind === 'doctor' ? `врач: ${state.target.name}` : `специальность: ${state.target.title}`);
  if (state.slot) parts.push(`выбрано время: ${state.slot.dateLabel} ${state.slot.time}`);
  if (state.appointment) parts.push(`запись: ${state.appointment.date} ${state.appointment.time}`);
  return parts.join('; ');
}

function goalLabel(goal: Goal): string {
  return {
    book: 'запись', info: 'вопрос', cancel: 'отмена записи', reschedule: 'перенос записи',
    my_appointments: 'просмотр записей', smalltalk: 'разговор', other: 'прочее',
  }[goal];
}
