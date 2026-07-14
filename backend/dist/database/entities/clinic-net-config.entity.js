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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicNetConfig = void 0;
const typeorm_1 = require("typeorm");
const clinic_net_entity_1 = require("./clinic-net.entity");
let ClinicNetConfig = class ClinicNetConfig {
};
exports.ClinicNetConfig = ClinicNetConfig;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ClinicNetConfig.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'clinic_net_id' }),
    __metadata("design:type", Number)
], ClinicNetConfig.prototype, "clinicNetId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => clinic_net_entity_1.ClinicNet, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'clinic_net_id' }),
    __metadata("design:type", clinic_net_entity_1.ClinicNet)
], ClinicNetConfig.prototype, "clinicNet", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mis_type', length: 32, default: 'medflex' }),
    __metadata("design:type", String)
], ClinicNetConfig.prototype, "misType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'medflex_api_token', type: 'text', nullable: true }),
    __metadata("design:type", String)
], ClinicNetConfig.prototype, "medflexApiToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'medflex_lpu_id', length: 128, nullable: true }),
    __metadata("design:type", String)
], ClinicNetConfig.prototype, "medflexLpuId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'medflex_api_url', length: 255, default: 'https://api.medflex.ru' }),
    __metadata("design:type", String)
], ClinicNetConfig.prototype, "medflexApiUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'medflex_trigger_url', length: 255, default: 'https://api.medflex.ru' }),
    __metadata("design:type", String)
], ClinicNetConfig.prototype, "medflexTriggerUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'telegram_bot_token', type: 'text', nullable: true }),
    __metadata("design:type", String)
], ClinicNetConfig.prototype, "telegramBotToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_bot_token', type: 'text', nullable: true }),
    __metadata("design:type", String)
], ClinicNetConfig.prototype, "maxBotToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_bot_api_url', length: 255, default: 'https://myteam.mail.ru/bot/v1' }),
    __metadata("design:type", String)
], ClinicNetConfig.prototype, "maxBotApiUrl", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ClinicNetConfig.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ClinicNetConfig.prototype, "updatedAt", void 0);
exports.ClinicNetConfig = ClinicNetConfig = __decorate([
    (0, typeorm_1.Entity)('clinic_net_configs'),
    (0, typeorm_1.Unique)(['clinicNetId'])
], ClinicNetConfig);
//# sourceMappingURL=clinic-net-config.entity.js.map