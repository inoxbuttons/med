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
exports.ClinicNet = void 0;
const typeorm_1 = require("typeorm");
const clinic_entity_1 = require("./clinic.entity");
let ClinicNet = class ClinicNet {
};
exports.ClinicNet = ClinicNet;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ClinicNet.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255 }),
    __metadata("design:type", String)
], ClinicNet.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ClinicNet.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255, nullable: true }),
    __metadata("design:type", String)
], ClinicNet.prototype, "website", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true }),
    __metadata("design:type", String)
], ClinicNet.prototype, "mis", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'medflex_key', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClinicNet.prototype, "medflexKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'telegram_bot_token', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClinicNet.prototype, "telegramBotToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_bot_token', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClinicNet.prototype, "maxBotToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_bot_api_url', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClinicNet.prototype, "maxBotApiUrl", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => clinic_entity_1.Clinic, (clinic) => clinic.clinicNet),
    __metadata("design:type", Array)
], ClinicNet.prototype, "clinics", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ClinicNet.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ClinicNet.prototype, "updatedAt", void 0);
exports.ClinicNet = ClinicNet = __decorate([
    (0, typeorm_1.Entity)('clinic_nets')
], ClinicNet);
//# sourceMappingURL=clinic-net.entity.js.map