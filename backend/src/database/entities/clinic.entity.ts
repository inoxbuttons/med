import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClinicNet } from './clinic-net.entity';
import { DoctorLocation } from './doctor-location.entity';
import { ServiceByClinic } from './service-by-clinic.entity';
import { ServiceSchedule } from './service-schedule.entity';

@Entity('clinics')
export class Clinic {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_net_id', nullable: true })
  clinicNetId: number;

  @ManyToOne(() => ClinicNet, (net) => net.clinics, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinic_net_id' })
  clinicNet: ClinicNet;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 500, nullable: true })
  address: string;

  @Column({ length: 50, nullable: true })
  phone: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @OneToMany(() => DoctorLocation, (dl) => dl.clinic)
  doctorLocations: DoctorLocation[];

  @OneToMany(() => ServiceByClinic, (sbc) => sbc.clinic)
  servicesByClinics: ServiceByClinic[];

  @OneToMany(() => ServiceSchedule, (s) => s.clinic)
  serviceSchedules: ServiceSchedule[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
