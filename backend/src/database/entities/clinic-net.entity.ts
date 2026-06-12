import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Clinic } from './clinic.entity';

@Entity('clinic_nets')
export class ClinicNet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 255, nullable: true })
  website: string;

  /** Идентификатор МИС сети клиник, например 'infoclinica'. Null — используется локальная БД. */
  @Column({ length: 50, nullable: true })
  mis: string | null;

  /** API-ключ MedFlex для данной сети клиник. Используется при misType='medflex'. */
  @Column({ name: 'medflex_key', length: 255, nullable: true })
  medflexKey: string | null;

  /** Токен Telegram-бота для данной сети клиник. */
  @Column({ name: 'telegram_bot_token', length: 255, nullable: true })
  telegramBotToken: string | null;

  /** Токен MAX-бота для данной сети клиник. */
  @Column({ name: 'max_bot_token', length: 255, nullable: true })
  maxBotToken: string | null;

  /** URL API MAX-бота (по умолчанию https://myteam.mail.ru/bot/v1). */
  @Column({ name: 'max_bot_api_url', length: 255, nullable: true })
  maxBotApiUrl: string | null;

  @OneToMany(() => Clinic, (clinic) => clinic.clinicNet)
  clinics: Clinic[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
