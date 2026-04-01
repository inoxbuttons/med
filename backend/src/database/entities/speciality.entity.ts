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
import { MedField } from './med-field.entity';
import { Doctor } from './doctor.entity';

@Entity('specialities')
export class Speciality {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'med_field_id', nullable: true })
  medFieldId: number;

  @ManyToOne(() => MedField, (field) => field.specialities, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'med_field_id' })
  medField: MedField;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => Doctor, (doctor) => doctor.speciality)
  doctors: Doctor[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
