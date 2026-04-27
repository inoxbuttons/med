import { Repository } from 'typeorm';
import { ClinicNet } from '../database/entities/clinic-net.entity';
import { InfclinicaService } from '../integrations/infoclinica/infoclinica.service';
import { MedflexService } from '../integrations/medflex/medflex.service';
import { LocalDbService } from '../integrations/local/local-db.service';
import { LlmTool } from '../llm/llm.types';
import { PatientData } from '../chat/chat.types';
export type { SlotMode, ClinicInfo, DoctorInfo, ServiceInfo, SlotGroup, BookingResult, PatientAppointmentItem, CancellableAppointment, } from '../integrations/local/local-db.service';
export declare class BookingService {
    private readonly clinicNetRepo;
    private readonly localDbService;
    private readonly infoclinicaService;
    private readonly medflexService;
    private readonly logger;
    constructor(clinicNetRepo: Repository<ClinicNet>, localDbService: LocalDbService, infoclinicaService: InfclinicaService, medflexService: MedflexService);
    checkPatientTimeConflict(clientId: number, startTime: string): Promise<{
        description: string;
        id: number;
        type: "doctor" | "service";
    }>;
    rescheduleAppointment(params: Parameters<LocalDbService['rescheduleAppointment']>[0]): Promise<import("../integrations/local/local-db.service").BookingResult>;
    getTools(misType?: string): LlmTool[];
    executeTool(name: string, args: Record<string, any>, _sessionId?: string, clientId?: number, misType?: string, clinicNetId?: number, townId?: number, districtId?: number, patient?: PatientData): Promise<unknown>;
}
