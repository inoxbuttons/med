"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const schedule_1 = require("@nestjs/schedule");
const notification_log_entity_1 = require("../database/entities/notification-log.entity");
const messenger_contact_entity_1 = require("../database/entities/messenger-contact.entity");
const appointment_entity_1 = require("../database/entities/appointment.entity");
const telegram_module_1 = require("../messengers/telegram/telegram.module");
const max_module_1 = require("../messengers/max/max.module");
const clinic_config_module_1 = require("../clinic-config/clinic-config.module");
const notification_config_service_1 = require("./notification-config.service");
const notification_service_1 = require("./notification.service");
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            typeorm_1.TypeOrmModule.forFeature([notification_log_entity_1.NotificationLog, messenger_contact_entity_1.MessengerContact, appointment_entity_1.Appointment]),
            telegram_module_1.TelegramModule,
            max_module_1.MaxModule,
            clinic_config_module_1.ClinicConfigModule,
        ],
        providers: [notification_config_service_1.NotificationConfigService, notification_service_1.NotificationService],
    })
], NotificationsModule);
//# sourceMappingURL=notifications.module.js.map