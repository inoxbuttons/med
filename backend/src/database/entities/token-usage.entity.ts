import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClinicNet } from './clinic-net.entity';

@Entity('token_usage')
@Index(['clinicNetId', 'createdAt'])
export class TokenUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_net_id', nullable: true })
  clinicNetId: number | null;

  @ManyToOne(() => ClinicNet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinic_net_id' })
  clinicNet: ClinicNet;

  @Column({ name: 'session_id', length: 255 })
  sessionId: string;

  @Column({ length: 50 })
  provider: string;

  @Column({ name: 'prompt_tokens' })
  promptTokens: number;

  @Column({ name: 'completion_tokens' })
  completionTokens: number;

  @Column({ name: 'total_tokens' })
  totalTokens: number;

  /** Задача модели: legacy, nlu, answer, symptoms, agent, embed. */
  @Column({ length: 20, nullable: true })
  task: string | null;

  /** Версия промпта (PromptBuilder.hash). */
  @Column({ name: 'prompt_hash', length: 12, nullable: true })
  promptHash: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
