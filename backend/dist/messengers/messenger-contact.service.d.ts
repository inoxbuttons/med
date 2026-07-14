import { Repository } from 'typeorm';
import { MessengerContact, MessengerType } from '../database/entities/messenger-contact.entity';
import { Person } from '../database/entities/person.entity';
export declare class MessengerContactService {
    private readonly contactRepo;
    private readonly personRepo;
    private readonly logger;
    constructor(contactRepo: Repository<MessengerContact>, personRepo: Repository<Person>);
    findContact(clinicNetId: number, messenger: MessengerType, chatId: string): Promise<MessengerContact | null>;
    findPersonByPhone(phone: string): Promise<Person | null>;
    linkContact(clinicNetId: number, messenger: MessengerType, chatId: string, personId: number | null): Promise<MessengerContact>;
    findContactsByPersonId(personId: number): Promise<MessengerContact[]>;
    findContactsByPhone(phone: string): Promise<MessengerContact[]>;
}
