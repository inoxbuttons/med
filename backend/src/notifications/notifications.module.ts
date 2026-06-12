import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationLog } from '../database/entities/notification-log.entity';
import { MessengerContact } from '../database/entities/messenger-contact.entity';
import { Appointment } from '../database/entities/appointment.entity';
import { TelegramModule } from '../messengers/telegram/telegram.module';
import { MaxModule } from '../messengers/max/max.module';
import { ClinicConfigModule } from '../clinic-config/clinic-config.module';
import { NotificationConfigService } from './notification-config.service';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([NotificationLog, MessengerContact, Appointment]),
    TelegramModule,
    MaxModule,
    ClinicConfigModule,
  ],
  providers: [NotificationConfigService, NotificationService],
})
export class NotificationsModule {}
