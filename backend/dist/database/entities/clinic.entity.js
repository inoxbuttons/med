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
exports.Clinic = void 0;
const typeorm_1 = require("typeorm");
const clinic_net_entity_1 = require("./clinic-net.entity");
const doctor_location_entity_1 = require("./doctor-location.entity");
const service_by_clinic_entity_1 = require("./service-by-clinic.entity");
const service_schedule_entity_1 = require("./service-schedule.entity");
let Clinic = class Clinic {
};
exports.Clinic = Clinic;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Clinic.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'clinic_net_id', nullable: true }),
    __metadata("design:type", Number)
], Clinic.prototype, "clinicNetId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => clinic_net_entity_1.ClinicNet, (net) => net.clinics, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'clinic_net_id' }),
    __metadata("design:type", clinic_net_entity_1.ClinicNet)
], Clinic.prototype, "clinicNet", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255 }),
    __metadata("design:type", String)
], Clinic.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 500, nullable: true }),
    __metadata("design:type", String)
], Clinic.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50, nullable: true }),
    __metadata("design:type", String)
], Clinic.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255, nullable: true }),
    __metadata("design:type", String)
], Clinic.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 7, nullable: true }),
    __metadata("design:type", Number)
], Clinic.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 7, nullable: true }),
    __metadata("design:type", Number)
], Clinic.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => doctor_location_entity_1.DoctorLocation, (dl) => dl.clinic),
    __metadata("design:type", Array)
], Clinic.prototype, "doctorLocations", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => service_by_clinic_entity_1.ServiceByClinic, (sbc) => sbc.clinic),
    __metadata("design:type", Array)
], Clinic.prototype, "servicesByClinics", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => service_schedule_entity_1.ServiceSchedule, (s) => s.clinic),
    __metadata("design:type", Array)
], Clinic.prototype, "serviceSchedules", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Clinic.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Clinic.prototype, "updatedAt", void 0);
exports.Clinic = Clinic = __decorate([
    (0, typeorm_1.Entity)('clinics')
], Clinic);
//# sourceMappingURL=clinic.entity.js.map