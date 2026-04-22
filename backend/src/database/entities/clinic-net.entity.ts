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

  @OneToMany(() => Clinic, (clinic) => clinic.clinicNet)
  clinics: Clinic[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
