import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from '../../chat/chat.module';
import { ClinicConfigModule } from '../../clinic-config/clinic-config.module';
import { MessengerContact } from '../../database/entities/messenger-contact.entity';
import { Person } from '../../database/entities/person.entity';
import { MessengerContactService } from '../messenger-contact.service';
import { MaxBot } from './max.bot';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessengerContact, Person]),
    ChatModule,
    ClinicConfigModule,
  ],
  providers: [MessengerContactService, MaxBot],
  exports: [MaxBot, MessengerContactService],
})
export class MaxModule {}
