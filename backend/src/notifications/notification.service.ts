import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { NotificationLog } from '../database/entities/notification-log.entity';
import { MessengerContact } from '../database/entities/messenger-contact.entity';
import { Appointment } from '../database/entities/appointment.entity';
import { TelegramBot } from '../messengers/telegram/telegram.bot';
import { MaxBot } from '../messengers/max/max.bot';
import { NotificationConfigService } from './notification-config.service';
import { ClinicNetConfigService } from '../clinic-config/clinic-net-config.service';

interface UpcomingAppointment {
  id: string;
  type: 'doctor' | 'service';
  startTime: Date;
  clinicId: string;
  clinicName: string;
  doctorName?: string;
  serviceName?: string;
  patientPhone?: string;
  patientName?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    @InjectRepository(MessengerContact)
    private readonly contactRepo: Repository<MessengerContact>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    private readonly tgBot: TelegramBot,
    private readonly maxBot: MaxBot,
    private readonly notifConfig: NotificationConfigService,
    private readonly clinicConfigService: ClinicNetConfigService,
  ) {}

  @Cron('0 */30 * * * *')
  async checkAndSendNotifications(): Promise<void> {
    this.logger.log('Running notification check...');
    const { offsetMinutes, toleranceMinutes } = this.notifConfig;
    const now = new Date();
    const allConfigs = this.clinicConfigService.getAllConfigs();

    for (const clinicCfg of allConfigs) {
      for (const offset of offsetMinutes) {
        const windowFrom = new Date(now.getTime() + (offset - toleranceMinutes) * 60_000);
        const windowTo   = new Date(now.getTime() + (offset + toleranceMinutes) * 60_000);

        let appointments: UpcomingAppointment[];
        try {
          appointments = clinicCfg.medflexApiToken
            ? await this.fetchMedflexAppointments(clinicCfg.medflexApiToken, clinicCfg.medflexTriggerUrl, clinicCfg.clinicNetId, windowFrom, windowTo)
            : await this.fetchLocalAppointments(clinicCfg.clinicNetId, windowFrom, windowTo);
        } catch (err) {
          this.logger.error(`clinicNet=${clinicCfg.clinicNetId} offset=${offset}min: ${err}`);
          continue;
        }

        this.logger.debug(`clinicNet=${clinicCfg.clinicNetId} offset=${offset}min: ${appointments.length} appointments`);

        for (const appt of appointments) {
          await this.processAppointment(appt, offset, clinicCfg.clinicNetId);
        }
      }
    }
  }

  /** Получить записи из локальной БД */
  private async fetchLocalAppointments(
    clinicNetId: number,
    from: Date,
    to: Date,
  ): Promise<UpcomingAppointment[]> {
    const rows = await this.appointmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.clinic', 'clinic')
      .leftJoinAndSelect('a.doctor', 'doctor')
      .leftJoinAndSelect('a.service', 'service')
      .leftJoinAndSelect('clinic.clinicNet', 'cn')
      .where('cn.id = :clinicNetId', { clinicNetId })
      .andWhere('a.start_time BETWEEN :from AND :to', { from, to })
      .andWhere("a.status NOT IN ('cancelled','completed','no_show')")
      .getMany();

    return rows.map((a) => ({
      id:          String(a.id),
      type:        a.doctorId ? 'doctor' : 'service',
      startTime:   a.startTime,
      clinicId:    String(a.clinicId),
      clinicName:  a.clinic?.name ?? '',
      doctorName:  a.doctor?.name ?? undefined,
      serviceName: (a as any).service?.name,
    }));
  }

  /** Получить записи из MedFlex Trigger API */
  private async fetchMedflexAppointments(
    apiToken: string,
    triggerUrl: string,
    clinicNetId: number,
    from: Date,
    to: Date,
  ): Promise<UpcomingAppointment[]> {
    const params = new URLSearchParams({
      dt_start_from: from.toISOString(),
      dt_start_to:   to.toISOString(),
    });
    const url = `${triggerUrl}/appointments/appointments/?${params}`;

    const resp = await fetch(url, {
      headers: { Authorization: apiToken },
    });
    if (!resp.ok) throw new Error(`MedFlex trigger API error: ${resp.status}`);

    const data: { results: any[] } = await resp.json();
    return (data.results ?? []).map((a: any) => ({
      id:           String(a.uuid ?? a.id),
      type:         a.doctor_id ? 'doctor' : 'service',
      startTime:    new Date(a.dt_start ?? a.start_time),
      clinicId:     String(a.lpu_id ?? ''),
      clinicName:   a.lpu_name ?? '',
      doctorName:   a.doctor_full_name,
      serviceName:  a.service_name,
      patientPhone: a.patient_phone ?? a.phone,
      patientName:  a.patient_full_name ?? a.patient_name,
    }));
  }

  private async processAppointment(
    appt: UpcomingAppointment,
    offsetMinutes: number,
    clinicNetId: number,
  ): Promise<void> {
    const contacts = await this.findPatientContacts(appt, clinicNetId);
    for (const contact of contacts) {
      await this.maybeSendNotification(appt, contact, offsetMinutes, clinicNetId);
    }
  }

  private async findPatientContacts(appt: UpcomingAppointment, clinicNetId: number): Promise<MessengerContact[]> {
    if (!appt.patientPhone) return [];
    const normalized = appt.patientPhone.replace(/\D/g, '').slice(-10);
    return this.contactRepo
      .createQueryBuilder('mc')
      .innerJoin('mc.person', 'p')
      .where('mc.clinic_net_id = :clinicNetId', { clinicNetId })
      .andWhere("REGEXP_REPLACE(p.phone, '[^0-9]', '', 'g') LIKE :phone", { phone: `%${normalized}` })
      .getMany();
  }

  private async maybeSendNotification(
    appt: UpcomingAppointment,
    contact: MessengerContact,
    offsetMinutes: number,
    clinicNetId: number,
  ): Promise<void> {
    const alreadySent = await this.logRepo.findOne({
      where: {
        externalApptId: appt.id,
        offsetMinutes,
        messenger: contact.messenger,
        chatId: contact.chatId,
      },
    });
    if (alreadySent) return;

    const text = this.buildMessage(appt, offsetMinutes);
    try {
      await this.sendViaMessenger(clinicNetId, contact.messenger, contact.chatId, text);
      await this.logRepo.save(this.logRepo.create({
        clinicNetId,
        externalApptId:  appt.id,
        appointmentType: appt.type,
        messenger:       contact.messenger,
        chatId:          contact.chatId,
        offsetMinutes,
        status: 'sent',
      }));
      this.logger.log(`Sent: appt=${appt.id} offset=${offsetMinutes}min → ${contact.messenger}:${contact.chatId}`);
    } catch (err) {
      this.logger.error(`Failed: appt=${appt.id} → ${contact.messenger}:${contact.chatId}: ${err}`);
      await this.logRepo.save(this.logRepo.create({
        clinicNetId,
        externalApptId:  appt.id,
        appointmentType: appt.type,
        messenger:       contact.messenger,
        chatId:          contact.chatId,
        offsetMinutes,
        status: 'failed',
        errorMessage: String(err),
      })).catch(() => undefined);
    }
  }

  private buildMessage(appt: UpcomingAppointment, offsetMinutes: number): string {
    const when = offsetMinutes < 120
      ? `через ${offsetMinutes} минут`
      : `через ${Math.round(offsetMinutes / 60)} ч`;

    const dateStr = appt.startTime.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const timeStr = appt.startTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const who = appt.doctorName
      ? `👨‍⚕️ Врач: *${appt.doctorName}*\n`
      : appt.serviceName
        ? `🩺 Услуга: *${appt.serviceName}*\n`
        : '';

    return (
      `⏰ *Напоминание о записи*\n\n` +
      `Вы записаны ${when} (${dateStr} в ${timeStr}).\n` +
      `🏥 Клиника: ${appt.clinicName}\n` +
      who +
      `\nЕсли хотите перенести или отменить — напишите мне.`
    );
  }

  private async sendViaMessenger(clinicNetId: number, messenger: string, chatId: string, text: string): Promise<void> {
    switch (messenger) {
      case 'telegram': await this.tgBot.sendNotification(clinicNetId, chatId, text); break;
      case 'max':      await this.maxBot.sendNotification(clinicNetId, chatId, text); break;
      default: throw new Error(`Unknown messenger: ${messenger}`);
    }
  }
}
