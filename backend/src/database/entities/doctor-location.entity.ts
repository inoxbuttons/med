import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { Clinic } from './clinic.entity';

@Entity('doctor_locations')
export class DoctorLocation {
  @PrimaryColumn({ name: 'doctor_id' })
  doctorId: number;

  @PrimaryColumn({ name: 'clinic_id' })
  clinicId: number;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  price: number;
}
