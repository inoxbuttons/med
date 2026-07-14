import { ClinicNet } from './clinic-net.entity';
export declare class ClinicNetConfig {
    id: number;
    clinicNetId: number;
    clinicNet: ClinicNet;
    misType: string;
    medflexApiToken: string | null;
    medflexLpuId: string | null;
    medflexApiUrl: string;
    medflexTriggerUrl: string;
    telegramBotToken: string | null;
    maxBotToken: string | null;
    maxBotApiUrl: string;
    createdAt: Date;
    updatedAt: Date;
}
