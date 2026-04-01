import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';

export enum DoctorExceptionType {
  DAY_OFF    = 'day_off',    // выходной
  SICK_LEAVE = 'sick_leave', // больничный
  VACATION   = 'vacation',   // отпуск
  TRAINING   = 'training',   // обучение
  OTHER      = 'other',      // другое
}

@Entity('doctor_exceptions')
export class DoctorException {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'doctor_id' })
  doctorId: number;

  @Column({ type: 'date' })
  date: string;

  /** Если null — отсутствует весь день */
  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime: string | null;

  /** Если null — отсутствует весь день */
  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime: string | null;

  @Column({ type: 'varchar', length: 32, default: DoctorExceptionType.DAY_OFF })
  type: DoctorExceptionType;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
