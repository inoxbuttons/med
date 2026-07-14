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
exports.NotificationLog = void 0;
const typeorm_1 = require("typeorm");
let NotificationLog = class NotificationLog {
};
exports.NotificationLog = NotificationLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], NotificationLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'clinic_net_id', nullable: true }),
    __metadata("design:type", Number)
], NotificationLog.prototype, "clinicNetId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_appt_id', length: 128 }),
    __metadata("design:type", String)
], NotificationLog.prototype, "externalApptId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'appointment_type', length: 16, default: 'doctor' }),
    __metadata("design:type", String)
], NotificationLog.prototype, "appointmentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 32 }),
    __metadata("design:type", String)
], NotificationLog.prototype, "messenger", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chat_id', length: 128 }),
    __metadata("design:type", String)
], NotificationLog.prototype, "chatId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'offset_minutes' }),
    __metadata("design:type", Number)
], NotificationLog.prototype, "offsetMinutes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'sent_at' }),
    __metadata("design:type", Date)
], NotificationLog.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 16, default: 'sent' }),
    __metadata("design:type", String)
], NotificationLog.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", String)
], NotificationLog.prototype, "errorMessage", void 0);
exports.NotificationLog = NotificationLog = __decorate([
    (0, typeorm_1.Entity)('notification_logs'),
    (0, typeorm_1.Unique)(['externalApptId', 'offsetMinutes', 'messenger', 'chatId'])
], NotificationLog);
//# sourceMappingURL=notification-log.entity.js.map