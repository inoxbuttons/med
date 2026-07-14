import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ClinicNet } from '../database/entities/clinic-net.entity';
export interface ResolvedClinicConfig {
    clinicNetId: number;
    clinicNetName: string;
    misType: 'medflex' | 'infoclinica' | null;
    medflexApiToken: string | null;
    medflexTriggerUrl: string;
    telegramBotToken: string | null;
    maxBotToken: string | null;
    maxBotApiUrl: string;
}
export declare class ClinicNetConfigService implements OnModuleInit {
    private readonly clinicNetRepo;
    private readonly env;
    private readonly logger;
    private configs;
    constructor(clinicNetRepo: Repository<ClinicNet>, env: ConfigService);
    onModuleInit(): Promise<void>;
    reload(): Promise<void>;
    getConfig(clinicNetId: number): ResolvedClinicConfig | undefined;
    getAllConfigs(): ResolvedClinicConfig[];
    private envDefaults;
}
