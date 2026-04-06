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
exports.DoctorWorkingHours = void 0;
const typeorm_1 = require("typeorm");
const doctor_entity_1 = require("./doctor.entity");
const clinic_entity_1 = require("./clinic.entity");
let DoctorWorkingHours = class DoctorWorkingHours {
};
exports.DoctorWorkingHours = DoctorWorkingHours;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], DoctorWorkingHours.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'doctor_id' }),
    __metadata("design:type", Number)
], DoctorWorkingHours.prototype, "doctorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'clinic_id' }),
    __metadata("design:type", Number)
], DoctorWorkingHours.prototype, "clinicId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'day_of_week', type: 'smallint' }),
    __metadata("design:type", Number)
], DoctorWorkingHours.prototype, "dayOfWeek", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'start_time', type: 'time' }),
    __metadata("design:type", String)
], DoctorWorkingHours.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'end_time', type: 'time' }),
    __metadata("design:type", String)
], DoctorWorkingHours.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'slot_duration', type: 'smallint', default: 30 }),
    __metadata("design:type", Number)
], DoctorWorkingHours.prototype, "slotDuration", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'break_start', type: 'time', nullable: true }),
    __metadata("design:type", String)
], DoctorWorkingHours.prototype, "breakStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'break_end', type: 'time', nullable: true }),
    __metadata("design:type", String)
], DoctorWorkingHours.prototype, "breakEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], DoctorWorkingHours.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => doctor_entity_1.Doctor, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'doctor_id' }),
    __metadata("design:type", doctor_entity_1.Doctor)
], DoctorWorkingHours.prototype, "doctor", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => clinic_entity_1.Clinic, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'clinic_id' }),
    __metadata("design:type", clinic_entity_1.Clinic)
], DoctorWorkingHours.prototype, "clinic", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DoctorWorkingHours.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], DoctorWorkingHours.prototype, "updatedAt", void 0);
exports.DoctorWorkingHours = DoctorWorkingHours = __decorate([
    (0, typeorm_1.Entity)('doctor_working_hours')
], DoctorWorkingHours);
//# sourceMappingURL=doctor-working-hours.entity.js.map