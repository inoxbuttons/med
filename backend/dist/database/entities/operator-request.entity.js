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
exports.OperatorRequest = void 0;
const typeorm_1 = require("typeorm");
let OperatorRequest = class OperatorRequest {
};
exports.OperatorRequest = OperatorRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], OperatorRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'clinic_id', nullable: true }),
    __metadata("design:type", Number)
], OperatorRequest.prototype, "clinicId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'service_id', nullable: true }),
    __metadata("design:type", Number)
], OperatorRequest.prototype, "serviceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'doctor_id', nullable: true }),
    __metadata("design:type", Number)
], OperatorRequest.prototype, "doctorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'patient_id', nullable: true }),
    __metadata("design:type", Number)
], OperatorRequest.prototype, "patientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'patient_name', length: 255, nullable: true }),
    __metadata("design:type", String)
], OperatorRequest.prototype, "patientName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'patient_phone', length: 50, nullable: true }),
    __metadata("design:type", String)
], OperatorRequest.prototype, "patientPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'patient_birthday', type: 'date', nullable: true }),
    __metadata("design:type", String)
], OperatorRequest.prototype, "patientBirthday", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'request_type', length: 50, default: 'service_booking' }),
    __metadata("design:type", String)
], OperatorRequest.prototype, "requestType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OperatorRequest.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'session_id', length: 255, nullable: true }),
    __metadata("design:type", String)
], OperatorRequest.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, default: 'new' }),
    __metadata("design:type", String)
], OperatorRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], OperatorRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], OperatorRequest.prototype, "updatedAt", void 0);
exports.OperatorRequest = OperatorRequest = __decorate([
    (0, typeorm_1.Entity)('operator_requests')
], OperatorRequest);
//# sourceMappingURL=operator-request.entity.js.map