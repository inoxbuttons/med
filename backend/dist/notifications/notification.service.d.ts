import { Repository } from 'typeorm';
import { NotificationLog } from '../database/entities/notification-log.entity';
import { MessengerContact } from '../database/entities/messenger-contact.entity';
import { Appointment } from '../database/entities/appointment.entity';
import { TelegramBot } from '../messengers/telegram/telegram.bot';
import { MaxBot } from '../messengers/max/max.bot';
import { NotificationConfigService } from './notification-config.service';
import { ClinicNetConfigService } from '../clinic-config/clinic-net-config.service';
export declare class NotificationService {
    private readonly logRepo;
    private readonly contactRepo;
    private readonly appointmentRepo;
    private readonly tgBot;
    private readonly maxBot;
    private readonly notifConfig;
    private readonly clinicConfigService;
    private readonly logger;
    constructor(logRepo: Repository<NotificationLog>, contactRepo: Repository<MessengerContact>, appointmentRepo: Repository<Appointment>, tgBot: TelegramBot, maxBot: MaxBot, notifConfig: NotificationConfigService, clinicConfigService: ClinicNetConfigService);
    checkAndSendNotifications(): Promise<void>;
    private fetchLocalAppointments;
    private fetchMedflexAppointments;
    private processAppointment;
    private findPatientContacts;
    private maybeSendNotification;
    private buildMessage;
    private sendViaMessenger;
}
