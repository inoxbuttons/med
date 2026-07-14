"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const chat_module_1 = require("../../chat/chat.module");
const clinic_config_module_1 = require("../../clinic-config/clinic-config.module");
const messenger_contact_entity_1 = require("../../database/entities/messenger-contact.entity");
const person_entity_1 = require("../../database/entities/person.entity");
const messenger_contact_service_1 = require("../messenger-contact.service");
const telegram_bot_1 = require("./telegram.bot");
let TelegramModule = class TelegramModule {
};
exports.TelegramModule = TelegramModule;
exports.TelegramModule = TelegramModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([messenger_contact_entity_1.MessengerContact, person_entity_1.Person]),
            chat_module_1.ChatModule,
            clinic_config_module_1.ClinicConfigModule,
        ],
        providers: [messenger_contact_service_1.MessengerContactService, telegram_bot_1.TelegramBot],
        exports: [telegram_bot_1.TelegramBot, messenger_contact_service_1.MessengerContactService],
    })
], TelegramModule);
//# sourceMappingURL=telegram.module.js.map