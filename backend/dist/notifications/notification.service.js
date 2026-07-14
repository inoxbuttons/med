"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_log_entity_1 = require("../database/entities/notification-log.entity");
const messenger_contact_entity_1 = require("../database/entities/messenger-contact.entity");
const appointment_entity_1 = require("../database/entities/appointment.entity");
const telegram_bot_1 = require("../messengers/telegram/telegram.bot");
const max_bot_1 = require("../messengers/max/max.bot");
const notification_config_service_1 = require("./notification-config.service");
const clinic_net_config_service_1 = require("../clinic-config/clinic-net-config.service");
let NotificationService = NotificationService_1 = class NotificationService {
    constructor(logRepo, contactRepo, appointmentRepo, tgBot, maxBot, notifConfig, clinicConfigService) {
        this.logRepo = logRepo;
        this.contactRepo = contactRepo;
        this.appointmentRepo = appointmentRepo;
        this.tgBot = tgBot;
        this.maxBot = maxBot;
        this.notifConfig = notifConfig;
        this.clinicConfigService = clinicConfigService;
        this.logger = new common_1.Logger(NotificationService_1.name);
    }
    async checkAndSendNotifications() {
        this.logger.log('Running notification check...');
        const { offsetMinutes, toleranceMinutes } = this.notifConfig;
        const now = new Date();
        const allConfigs = this.clinicConfigService.getAllConfigs();
        for (const clinicCfg of allConfigs) {
            for (const offset of offsetMinutes) {
                const windowFrom = new Date(now.getTime() + (offset - toleranceMinutes) * 60_000);
                const windowTo = new Date(now.getTime() + (offset + toleranceMinutes) * 60_000);
                let appointments;
                try {
                    appointments = clinicCfg.medflexApiToken
                        ? await this.fetchMedflexAppointments(clinicCfg.medflexApiToken, clinicCfg.medflexTriggerUrl, clinicCfg.clinicNetId, windowFrom, windowTo)
                        : await this.fetchLocalAppointments(clinicCfg.clinicNetId, windowFrom, windowTo);
                }
                catch (err) {
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
    async fetchLocalAppointments(clinicNetId, from, to) {
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
            id: String(a.id),
            type: a.doctorId ? 'doctor' : 'service',
            startTime: a.startTime,
            clinicId: String(a.clinicId),
            clinicName: a.clinic?.name ?? '',
            doctorName: a.doctor?.name ?? undefined,
            serviceName: a.service?.name,
        }));
    }
    async fetchMedflexAppointments(apiToken, triggerUrl, clinicNetId, from, to) {
        const params = new URLSearchParams({
            dt_start_from: from.toISOString(),
            dt_start_to: to.toISOString(),
        });
        const url = `${triggerUrl}/appointments/appointments/?${params}`;
        const resp = await fetch(url, {
            headers: { Authorization: apiToken },
        });
        if (!resp.ok)
            throw new Error(`MedFlex trigger API error: ${resp.status}`);
        const data = await resp.json();
        return (data.results ?? []).map((a) => ({
            id: String(a.uuid ?? a.id),
            type: a.doctor_id ? 'doctor' : 'service',
            startTime: new Date(a.dt_start ?? a.start_time),
            clinicId: String(a.lpu_id ?? ''),
            clinicName: a.lpu_name ?? '',
            doctorName: a.doctor_full_name,
            serviceName: a.service_name,
            patientPhone: a.patient_phone ?? a.phone,
            patientName: a.patient_full_name ?? a.patient_name,
        }));
    }
    async processAppointment(appt, offsetMinutes, clinicNetId) {
        const contacts = await this.findPatientContacts(appt, clinicNetId);
        for (const contact of contacts) {
            await this.maybeSendNotification(appt, contact, offsetMinutes, clinicNetId);
        }
    }
    async findPatientContacts(appt, clinicNetId) {
        if (!appt.patientPhone)
            return [];
        const normalized = appt.patientPhone.replace(/\D/g, '').slice(-10);
        return this.contactRepo
            .createQueryBuilder('mc')
            .innerJoin('mc.person', 'p')
            .where('mc.clinic_net_id = :clinicNetId', { clinicNetId })
            .andWhere("REGEXP_REPLACE(p.phone, '[^0-9]', '', 'g') LIKE :phone", { phone: `%${normalized}` })
            .getMany();
    }
    async maybeSendNotification(appt, contact, offsetMinutes, clinicNetId) {
        const alreadySent = await this.logRepo.findOne({
            where: {
                externalApptId: appt.id,
                offsetMinutes,
                messenger: contact.messenger,
                chatId: contact.chatId,
            },
        });
        if (alreadySent)
            return;
        const text = this.buildMessage(appt, offsetMinutes);
        try {
            await this.sendViaMessenger(clinicNetId, contact.messenger, contact.chatId, text);
            await this.logRepo.save(this.logRepo.create({
                clinicNetId,
                externalApptId: appt.id,
                appointmentType: appt.type,
                messenger: contact.messenger,
                chatId: contact.chatId,
                offsetMinutes,
                status: 'sent',
            }));
            this.logger.log(`Sent: appt=${appt.id} offset=${offsetMinutes}min → ${contact.messenger}:${contact.chatId}`);
        }
        catch (err) {
            this.logger.error(`Failed: appt=${appt.id} → ${contact.messenger}:${contact.chatId}: ${err}`);
            await this.logRepo.save(this.logRepo.create({
                clinicNetId,
                externalApptId: appt.id,
                appointmentType: appt.type,
                messenger: contact.messenger,
                chatId: contact.chatId,
                offsetMinutes,
                status: 'failed',
                errorMessage: String(err),
            })).catch(() => undefined);
        }
    }
    buildMessage(appt, offsetMinutes) {
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
        return (`⏰ *Напоминание о записи*\n\n` +
            `Вы записаны ${when} (${dateStr} в ${timeStr}).\n` +
            `🏥 Клиника: ${appt.clinicName}\n` +
            who +
            `\nЕсли хотите перенести или отменить — напишите мне.`);
    }
    async sendViaMessenger(clinicNetId, messenger, chatId, text) {
        switch (messenger) {
            case 'telegram':
                await this.tgBot.sendNotification(clinicNetId, chatId, text);
                break;
            case 'max':
                await this.maxBot.sendNotification(clinicNetId, chatId, text);
                break;
            default: throw new Error(`Unknown messenger: ${messenger}`);
        }
    }
};
exports.NotificationService = NotificationService;
__decorate([
    (0, schedule_1.Cron)('0 */30 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationService.prototype, "checkAndSendNotifications", null);
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_log_entity_1.NotificationLog)),
    __param(1, (0, typeorm_1.InjectRepository)(messenger_contact_entity_1.MessengerContact)),
    __param(2, (0, typeorm_1.InjectRepository)(appointment_entity_1.Appointment)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        telegram_bot_1.TelegramBot,
        max_bot_1.MaxBot,
        notification_config_service_1.NotificationConfigService,
        clinic_net_config_service_1.ClinicNetConfigService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map