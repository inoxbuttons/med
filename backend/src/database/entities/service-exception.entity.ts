import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Service } from './service.entity';

export enum ServiceExceptionType {
  DAY_OFF     = 'day_off',     // выходной / закрыто
  MAINTENANCE = 'maintenance', // техническое обслуживание
  OTHER       = 'other',       // другое
}

@Entity('service_exceptions')
export class ServiceException {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'service_id' })
  serviceId: number;

  @Column({ type: 'date' })
  date: string;

  /** null — недоступна весь день */
  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime: string | null;

  /** null — недоступна весь день */
  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime: string | null;

  @Column({ type: 'varchar', length: 32, default: ServiceExceptionType.DAY_OFF })
  type: ServiceExceptionType;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
