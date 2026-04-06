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
exports.ServiceByClinic = void 0;
const typeorm_1 = require("typeorm");
const service_entity_1 = require("./service.entity");
const clinic_entity_1 = require("./clinic.entity");
let ServiceByClinic = class ServiceByClinic {
};
exports.ServiceByClinic = ServiceByClinic;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'service_id' }),
    __metadata("design:type", Number)
], ServiceByClinic.prototype, "serviceId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'clinic_id' }),
    __metadata("design:type", Number)
], ServiceByClinic.prototype, "clinicId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => service_entity_1.Service, (service) => service.servicesByClinics, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'service_id' }),
    __metadata("design:type", service_entity_1.Service)
], ServiceByClinic.prototype, "service", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => clinic_entity_1.Clinic, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'clinic_id' }),
    __metadata("design:type", clinic_entity_1.Clinic)
], ServiceByClinic.prototype, "clinic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'numeric', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ServiceByClinic.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ServiceByClinic.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ServiceByClinic.prototype, "updatedAt", void 0);
exports.ServiceByClinic = ServiceByClinic = __decorate([
    (0, typeorm_1.Entity)('services_by_clinics')
], ServiceByClinic);
//# sourceMappingURL=service-by-clinic.entity.js.map