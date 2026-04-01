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
import { Service } from './service.entity';
import { Clinic } from './clinic.entity';

export enum AppointmentStatus {
  SCHEDULED  = 'scheduled',   // запланирован
  CONFIRMED  = 'confirmed',   // подтверждён
  CANCELLED  = 'cancelled',   // отменён
  COMPLETED  = 'completed',   // завершён
  NO_SHOW    = 'no_show',     // не явился
}

export enum AppointmentSource {
  WEB    = 'web',       // с сайта
  PHONE  = 'phone',     // по телефону
  AI     = 'ai',        // через ИИ-ассистент
  ADMIN  = 'admin',     // оператором вручную
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'doctor_id', nullable: true })
  doctorId: number | null;

  @Column({ name: 'service_id', nullable: true })
  serviceId: number | null;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'patient_id', nullable: true })
  patientId: number | null;

  @ManyToOne(() => Doctor, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @ManyToOne(() => Service, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp' })
  endTime: Date;

  @Column({
    type: 'varchar',
    length: 32,
    default: AppointmentStatus.SCHEDULED,
  })
  status: AppointmentStatus;

  @Column({
    type: 'varchar',
    length: 32,
    default: AppointmentSource.WEB,
  })
  source: AppointmentSource;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
