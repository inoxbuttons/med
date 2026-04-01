import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MedField } from './med-field.entity';
import { ServiceByClinic } from './service-by-clinic.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'med_field_id', nullable: true })
  medFieldId: number;

  @ManyToOne(() => MedField, (field) => field.services, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'med_field_id' })
  medField: MedField;

  @Column({ length: 500 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => ServiceByClinic, (sbc) => sbc.service)
  servicesByClinics: ServiceByClinic[];
}
