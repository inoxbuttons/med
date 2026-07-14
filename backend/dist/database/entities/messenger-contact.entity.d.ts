import { Person } from './person.entity';
import { ClinicNet } from './clinic-net.entity';
export type MessengerType = 'telegram' | 'max';
export declare class MessengerContact {
    id: number;
    clinicNetId: number;
    personId: number | null;
    messenger: MessengerType;
    chatId: string;
    clinicNet: ClinicNet;
    person: Person | null;
    createdAt: Date;
}
