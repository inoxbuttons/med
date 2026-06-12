import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicNet } from '../database/entities/clinic-net.entity';
import { InfclinicaService } from '../integrations/infoclinica/infoclinica.service';
import { MedflexService } from '../integrations/medflex/medflex.service';
import { LocalDbService } from '../integrations/local/local-db.service';
import { LlmTool } from '../llm/llm.types';
import { PatientData } from '../chat/chat.types';

// Re-export interfaces consumed by chat.service and other modules
export type {
  SlotMode,
  ClinicInfo,
  DoctorInfo,
  ServiceInfo,
  SlotGroup,
  BookingResult,
  PatientAppointmentItem,
  CancellableAppointment,
} from '../integrations/local/local-db.service';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectRepository(ClinicNet)
    private readonly clinicNetRepo: Repository<ClinicNet>,
    private readonly localDbService: LocalDbService,
    private readonly infoclinicaService: InfclinicaService,
    private readonly medflexService: MedflexService,
  ) {}

  // ── Delegated local DB methods (used directly by chat.service) ─────────────

  checkPatientTimeConflict(clientId: number, startTime: string) {
    return this.localDbService.checkPatientTimeConflict(clientId, startTime);
  }

  rescheduleAppointment(params: Parameters<LocalDbService['rescheduleAppointment']>[0]) {
    return this.localDbService.rescheduleAppointment(params);
  }

  // ── Tool definitions ───────────────────────────────────────────────────────

  getTools(misType?: string, hasPatient?: boolean): LlmTool[] {
    if (misType === 'medflex') return this.medflexService.getTools(hasPatient);
    // infoclinica и локальная БД используют один и тот же набор инструментов
    return this.localDbService.getTools();
  }

  // ── Tool router ────────────────────────────────────────────────────────────

  async executeTool(
    name: string,
    args: Record<string, any>,
    _sessionId?: string,
    clientId?: number,
    misType?: string,
    clinicNetId?: number,
    townId?: number,
    districtId?: number,
    patient?: PatientData,
  ): Promise<unknown> {
    try {
      if (misType === 'infoclinica') {
        return this.infoclinicaService.executeTool(name, args, clientId);
      }
      if (misType === 'medflex') {
        let medflexKey: string | null = null;
        if (clinicNetId) {
          const clinicNet = await this.clinicNetRepo.findOne({ where: { id: clinicNetId } });
          medflexKey = clinicNet?.medflexKey ?? null;
        }
        // medflexKey = null → MedflexService сам перенаправит на mock-сервер
        return this.medflexService.executeTool(name, args, clientId, medflexKey, clinicNetId, townId, districtId, patient);
      }

      // Локальная БД (misType не задан или неизвестен)
      return this.localDbService.executeTool(name, args, clientId);
    } catch (err) {
      this.logger.error(`Tool ${name} error: ${String(err)}`);
      return { error: `Ошибка при выполнении ${name}. Пожалуйста, уточни данные и попробуй снова.` };
    }
  }
}
