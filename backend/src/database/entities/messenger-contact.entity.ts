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
import { ClinicNet } from './clinic-net.entity';

export type MessengerType = 'telegram' | 'max';

@Entity('messenger_contacts')
@Unique(['clinicNetId', 'messenger', 'chatId'])
export class MessengerContact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_net_id' })
  clinicNetId: number;

  @Column({ name: 'person_id', nullable: true })
  personId: number | null;

  @Column({ length: 32 })
  messenger: MessengerType;

  @Column({ name: 'chat_id', length: 128 })
  chatId: string;

  @ManyToOne(() => ClinicNet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_net_id' })
  clinicNet: ClinicNet;

  @ManyToOne(() => Person, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'person_id' })
  person: Person | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
