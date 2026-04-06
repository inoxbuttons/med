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
exports.DoctorLocation = void 0;
const typeorm_1 = require("typeorm");
const doctor_entity_1 = require("./doctor.entity");
const clinic_entity_1 = require("./clinic.entity");
let DoctorLocation = class DoctorLocation {
};
exports.DoctorLocation = DoctorLocation;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'doctor_id' }),
    __metadata("design:type", Number)
], DoctorLocation.prototype, "doctorId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'clinic_id' }),
    __metadata("design:type", Number)
], DoctorLocation.prototype, "clinicId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => doctor_entity_1.Doctor, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'doctor_id' }),
    __metadata("design:type", doctor_entity_1.Doctor)
], DoctorLocation.prototype, "doctor", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => clinic_entity_1.Clinic, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'clinic_id' }),
    __metadata("design:type", clinic_entity_1.Clinic)
], DoctorLocation.prototype, "clinic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], DoctorLocation.prototype, "price", void 0);
exports.DoctorLocation = DoctorLocation = __decorate([
    (0, typeorm_1.Entity)('doctor_locations')
], DoctorLocation);
//# sourceMappingURL=doctor-location.entity.js.map