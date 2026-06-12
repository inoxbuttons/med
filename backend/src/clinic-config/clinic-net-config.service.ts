import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ClinicNet } from '../database/entities/clinic-net.entity';

export interface ResolvedClinicConfig {
  clinicNetId: number;
  clinicNetName: string;
  misType: string | null;
  medflexApiToken: string | null;
  medflexTriggerUrl: string;
  telegramBotToken: string | null;
  maxBotToken: string | null;
  maxBotApiUrl: string;
}

/**
 * Загружает конфигурацию мессенджеров и API-ключей для каждой клинической сети.
 *
 * Источник данных — таблица clinic_nets (поля mis, medflex_key, telegram_bot_token и т.д.).
 * Env-переменные используются как fallback, если в БД для данной сети значение NULL.
 */
@Injectable()
export class ClinicNetConfigService implements OnModuleInit {
  private readonly logger = new Logger(ClinicNetConfigService.name);
  private configs: Map<number, ResolvedClinicConfig> = new Map();

  constructor(
    @InjectRepository(ClinicNet)
    private readonly clinicNetRepo: Repository<ClinicNet>,
    private readonly env: ConfigService,
  ) {}

  async onModuleInit() {
    await this.reload();
  }

  async reload(): Promise<void> {
    const nets = await this.clinicNetRepo.find();
    this.configs.clear();

    const envDefaults = this.envDefaults();
    for (const net of nets) {
      this.configs.set(net.id, {
        clinicNetId:      net.id,
        clinicNetName:    net.name,
        misType:          net.mis ?? null,
        medflexApiToken:  net.medflexKey    ?? envDefaults.medflexApiToken,
        medflexTriggerUrl: envDefaults.medflexTriggerUrl,
        telegramBotToken: net.telegramBotToken ?? envDefaults.telegramBotToken,
        maxBotToken:      net.maxBotToken      ?? envDefaults.maxBotToken,
        maxBotApiUrl:     net.maxBotApiUrl     || envDefaults.maxBotApiUrl,
      });
    }

    this.logger.log(`Loaded configs for ${this.configs.size} clinic net(s)`);
  }

  getConfig(clinicNetId: number): ResolvedClinicConfig | undefined {
    return this.configs.get(clinicNetId);
  }

  getAllConfigs(): ResolvedClinicConfig[] {
    return [...this.configs.values()];
  }

  private envDefaults() {
    return {
      medflexApiToken:   this.env.get<string>('MEDFLEX_API_TOKEN')   ?? null,
      medflexTriggerUrl: this.env.get<string>('MEDFLEX_TRIGGER_URL', 'https://api.medflex.ru'),
      telegramBotToken:  this.env.get<string>('TELEGRAM_BOT_TOKEN')  ?? null,
      maxBotToken:       this.env.get<string>('MAX_BOT_TOKEN')       ?? null,
      maxBotApiUrl:      this.env.get<string>('MAX_BOT_API_URL',     'https://myteam.mail.ru/bot/v1'),
    };
  }
}
