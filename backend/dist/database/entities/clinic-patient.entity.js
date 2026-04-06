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
exports.ClinicPatient = void 0;
const typeorm_1 = require("typeorm");
const person_entity_1 = require("./person.entity");
const clinic_entity_1 = require("./clinic.entity");
let ClinicPatient = class ClinicPatient {
};
exports.ClinicPatient = ClinicPatient;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ClinicPatient.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'person_id' }),
    __metadata("design:type", Number)
], ClinicPatient.prototype, "personId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'clinic_id' }),
    __metadata("design:type", Number)
], ClinicPatient.prototype, "clinicId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_id', nullable: true }),
    __metadata("design:type", Number)
], ClinicPatient.prototype, "externalId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'card_number', length: 100, nullable: true }),
    __metadata("design:type", String)
], ClinicPatient.prototype, "cardNumber", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => person_entity_1.Person, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'person_id' }),
    __metadata("design:type", person_entity_1.Person)
], ClinicPatient.prototype, "person", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => clinic_entity_1.Clinic, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'clinic_id' }),
    __metadata("design:type", clinic_entity_1.Clinic)
], ClinicPatient.prototype, "clinic", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ClinicPatient.prototype, "createdAt", void 0);
exports.ClinicPatient = ClinicPatient = __decorate([
    (0, typeorm_1.Entity)('clinic_patients'),
    (0, typeorm_1.Unique)(['personId', 'clinicId'])
], ClinicPatient);
//# sourceMappingURL=clinic-patient.entity.js.map