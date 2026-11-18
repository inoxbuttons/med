import { ActionResult, OperatorRequestInput } from '../../../core/domain';
import type { LocalDbService } from '../../../integrations/local/local-db.service';
import { fullName } from './patient-comment';

/**
 * Заявки администратору хранятся в нашей БД (operator_requests) для любой МИС.
 */
export async function createOperatorRequest(
  local: LocalDbService,
  input: OperatorRequestInput,
): Promise<ActionResult & { id: number }> {
  const serviceId = typeof input.serviceId === 'number' ? input.serviceId : undefined;
  const notes = [input.notes, serviceId === undefined && input.serviceId !== undefined ? `Услуга МИС: ${input.serviceId}` : null]
    .filter(Boolean)
    .join('. ');
  const res = await local.createOperatorRequest({
    clinicId: input.clinicId,
    serviceId,
    doctorId: input.doctorId,
    patientId: input.patient.clientId,
    patientName: fullName(input.patient) ?? undefined,
    patientPhone: input.patient.data?.phone,
    patientBirthday: input.patient.data?.birthday,
    notes: notes || undefined,
    sessionId: input.sessionId,
  });
  return { success: true, id: res.id, message: res.message };
}
