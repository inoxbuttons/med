"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaxModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const chat_module_1 = require("../../chat/chat.module");
const clinic_config_module_1 = require("../../clinic-config/clinic-config.module");
const messenger_contact_entity_1 = require("../../database/entities/messenger-contact.entity");
const person_entity_1 = require("../../database/entities/person.entity");
const messenger_contact_service_1 = require("../messenger-contact.service");
const max_bot_1 = require("./max.bot");
let MaxModule = class MaxModule {
};
exports.MaxModule = MaxModule;
exports.MaxModule = MaxModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([messenger_contact_entity_1.MessengerContact, person_entity_1.Person]),
            chat_module_1.ChatModule,
            clinic_config_module_1.ClinicConfigModule,
        ],
        providers: [messenger_contact_service_1.MessengerContactService, max_bot_1.MaxBot],
        exports: [max_bot_1.MaxBot, messenger_contact_service_1.MessengerContactService],
    })
], MaxModule);
//# sourceMappingURL=max.module.js.map