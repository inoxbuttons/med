import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Person } from './person.entity';
import { Clinic } from './clinic.entity';

@Entity('clinic_patients')
@Unique(['personId', 'clinicId'])
export class ClinicPatient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'person_id' })
  personId: number;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'external_id', nullable: true })
  externalId: number | null;

  @Column({ name: 'card_number', length: 100, nullable: true })
  cardNumber: string | null;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person: Person;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
