import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ClinicNet } from './clinic-net.entity';

@Entity('clinic_net_configs')
@Unique(['clinicNetId'])
export class ClinicNetConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_net_id' })
  clinicNetId: number;

  @ManyToOne(() => ClinicNet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_net_id' })
  clinicNet: ClinicNet;

  @Column({ name: 'mis_type', length: 32, default: 'medflex' })
  misType: string;

  // ── MedFlex ──────────────────────────────────────────────────────────────

  @Column({ name: 'medflex_api_token', type: 'text', nullable: true })
  medflexApiToken: string | null;

  @Column({ name: 'medflex_lpu_id', length: 128, nullable: true })
  medflexLpuId: string | null;

  @Column({ name: 'medflex_api_url', length: 255, default: 'https://api.medflex.ru' })
  medflexApiUrl: string;

  @Column({ name: 'medflex_trigger_url', length: 255, default: 'https://api.medflex.ru' })
  medflexTriggerUrl: string;

  // ── Telegram ─────────────────────────────────────────────────────────────

  @Column({ name: 'telegram_bot_token', type: 'text', nullable: true })
  telegramBotToken: string | null;

  // ── MAX ──────────────────────────────────────────────────────────────────

  @Column({ name: 'max_bot_token', type: 'text', nullable: true })
  maxBotToken: string | null;

  @Column({ name: 'max_bot_api_url', length: 255, default: 'https://myteam.mail.ru/bot/v1' })
  maxBotApiUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
