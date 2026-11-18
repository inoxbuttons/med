import { PatientIdentity } from '../../../core/domain';

/** Полное имя пациента «Фамилия Имя Отчество». */
export function fullName(p: PatientIdentity): string | null {
  const d = p.data;
  if (!d) return null;
  const name = [d.lastName, d.firstName, d.secondName].filter(Boolean).join(' ').trim();
  return name || null;
}

/**
 * Комментарий к записи: текст пациента + данные гостя (если МИС не хранит их отдельно).
 * Для авторизованного пациента (clientId) данные не дублируются.
 */
export function bookingComment(patient: PatientIdentity, comment?: string, extra?: string): string | undefined {
  const parts: string[] = [];
  if (comment) parts.push(comment);
  if (extra) parts.push(extra);
  if (!patient.clientId && patient.data) {
    const d = patient.data;
    parts.push(`Пациент: ${fullName(patient) ?? '—'}, тел. ${d.phone || '—'}, д. р. ${d.birthday || '—'}`);
  }
  return parts.length ? parts.join('. ') : undefined;
}
