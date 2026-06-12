import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { MessengerContact, MessengerType } from '../database/entities/messenger-contact.entity';
import { Person } from '../database/entities/person.entity';

@Injectable()
export class MessengerContactService {
  private readonly logger = new Logger(MessengerContactService.name);

  constructor(
    @InjectRepository(MessengerContact)
    private readonly contactRepo: Repository<MessengerContact>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
  ) {}

  async findContact(clinicNetId: number, messenger: MessengerType, chatId: string): Promise<MessengerContact | null> {
    return this.contactRepo.findOne({
      where: { clinicNetId, messenger, chatId },
      relations: ['person'],
    });
  }

  async findPersonByPhone(phone: string): Promise<Person | null> {
    const last10 = phone.replace(/\D/g, '').slice(-10);
    return this.personRepo.findOne({
      where: [
        { phone: ILike(`%${last10}`) },
        { phone: ILike(`%${phone.replace(/\D/g, '')}`) },
      ],
    });
  }

  async linkContact(
    clinicNetId: number,
    messenger: MessengerType,
    chatId: string,
    personId: number | null,
  ): Promise<MessengerContact> {
    const existing = await this.contactRepo.findOne({ where: { clinicNetId, messenger, chatId } });

    if (existing) {
      existing.personId = personId;
      return this.contactRepo.save(existing);
    }

    const contact = this.contactRepo.create({ clinicNetId, messenger, chatId, personId });
    const saved = await this.contactRepo.save(contact);
    this.logger.log(`Linked ${messenger}:${chatId} (clinicNet=${clinicNetId}) → person_id=${personId ?? 'anonymous'}`);
    return saved;
  }

  async findContactsByPersonId(personId: number): Promise<MessengerContact[]> {
    return this.contactRepo.find({ where: { personId } });
  }

  async findContactsByPhone(phone: string): Promise<MessengerContact[]> {
    const person = await this.findPersonByPhone(phone);
    if (!person) return [];
    return this.findContactsByPersonId(person.id);
  }
}
