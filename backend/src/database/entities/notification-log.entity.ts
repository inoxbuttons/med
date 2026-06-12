import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('notification_logs')
@Unique(['externalApptId', 'offsetMinutes', 'messenger', 'chatId'])
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_net_id', nullable: true })
  clinicNetId: number | null;

  @Column({ name: 'external_appt_id', length: 128 })
  externalApptId: string;

  @Column({ name: 'appointment_type', length: 16, default: 'doctor' })
  appointmentType: string;

  @Column({ length: 32 })
  messenger: string;

  @Column({ name: 'chat_id', length: 128 })
  chatId: string;

  @Column({ name: 'offset_minutes' })
  offsetMinutes: number;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;

  @Column({ length: 16, default: 'sent' })
  status: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;
}
