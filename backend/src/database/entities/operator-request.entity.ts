import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type OperatorRequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';
export type OperatorRequestType = 'service_booking';

@Entity('operator_requests')
export class OperatorRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id', nullable: true })
  clinicId: number | null;

  @Column({ name: 'service_id', nullable: true })
  serviceId: number | null;

  @Column({ name: 'doctor_id', nullable: true })
  doctorId: number | null;

  @Column({ name: 'patient_id', nullable: true })
  patientId: number | null;

  @Column({ name: 'patient_name', length: 255, nullable: true })
  patientName: string | null;

  @Column({ name: 'patient_phone', length: 50, nullable: true })
  patientPhone: string | null;

  @Column({ name: 'patient_birthday', type: 'date', nullable: true })
  patientBirthday: string | null;

  @Column({ name: 'request_type', length: 50, default: 'service_booking' })
  requestType: OperatorRequestType;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'session_id', length: 255, nullable: true })
  sessionId: string | null;

  @Column({ length: 50, default: 'new' })
  status: OperatorRequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
