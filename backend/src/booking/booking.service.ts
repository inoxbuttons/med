import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicNet } from '../database/entities/clinic-net.entity';
import { InfclinicaService } from '../integrations/infoclinica/infoclinica.service';
import { MedflexService } from '../integrations/medflex/medflex.service';
import { LocalDbService } from '../integrations/local/local-db.service';
import { LlmTool } from '../llm/llm.types';
import { PatientData } from '../chat/chat.types';
import { CatalogSearch, relevantHits, SearchHit } from '../core/catalog/catalog-search.service';
import type { ServiceInfo } from '../integrations/local/local-db.service';

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
    private readonly catalogSearch: CatalogSearch,
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

      // Локальная БД (misType не задан или неизвестен).
      // Поиск услуг — по индексу каталога (синонимы, опечатки, падежи), если сеть проиндексирована.
      if (name === 'find_services' && clinicNetId && (await this.catalogSearch.hasIndex(clinicNetId, 'service'))) {
        return this.findServicesIndexed(clinicNetId, String(args.query ?? ''), args.clinicId);
      }
      return this.localDbService.executeTool(name, args, clientId, _sessionId, clinicNetId);
    } catch (err) {
      this.logger.error(`Tool ${name} error: ${String(err)}`);
      return { error: `Ошибка при выполнении ${name}. Пожалуйста, уточни данные и попробуй снова.` };
    }
  }

  /**
   * find_services через гибридный поиск. Остаются результаты с наибольшим покрытием слов запроса
   * (как раньше — совпадение всех слов, но с синонимами и морфологией); если по тексту ничего —
   * близкие по написанию (опечатки) и по смыслу (векторы).
   */
  async findServicesIndexed(clinicNetId: number, query: string, clinicId?: number): Promise<ServiceInfo[]> {
    const hits = await this.catalogSearch.search(clinicNetId, query, { kinds: ['service'], clinicId, limit: 40 });
    return selectRelevant(hits, 20).map((h) => ({
      id: Number(h.entityId),
      name: h.title,
      direction: h.meta.direction ?? null,
      selfBooking: !!h.meta.selfBooking,
      atDoctorVisit: !!h.meta.atDoctorVisit,
      stationary: !!h.meta.stationary,
      priceFrom: !!h.meta.priceFrom,
      clinics: (h.meta.clinics ?? []).filter((c: { id: number }) => !clinicId || c.id === clinicId),
    }));
  }
}

/**
 * Отбор релевантных результатов для LLM: лучшее покрытие слов запроса, если совпало
 * не меньше двух третей слов (для запроса из 1–2 слов — все); иначе — близкие по написанию
 * (опечатки) и по смыслу (векторы). Одно случайно совпавшее слово («зубов» → «зубовидного») не проходит.
 */
export function selectRelevant(hits: SearchHit[], limit: number): SearchHit[] {
  return relevantHits(hits).slice(0, limit);
}
