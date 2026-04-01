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
import { Speciality } from './speciality.entity';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'speciality_id', nullable: true })
  specialityId: number;

  @ManyToOne(() => Speciality, (spec) => spec.doctors, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'speciality_id' })
  speciality: Speciality;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'photo_url', length: 500, nullable: true })
  photoUrl: string;

  @Column({ name: 'profile_url', length: 500, nullable: true })
  profileUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
