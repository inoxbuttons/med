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
exports.Speciality = void 0;
const typeorm_1 = require("typeorm");
const med_field_entity_1 = require("./med-field.entity");
const doctor_entity_1 = require("./doctor.entity");
let Speciality = class Speciality {
};
exports.Speciality = Speciality;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Speciality.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'med_field_id', nullable: true }),
    __metadata("design:type", Number)
], Speciality.prototype, "medFieldId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => med_field_entity_1.MedField, (field) => field.specialities, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'med_field_id' }),
    __metadata("design:type", med_field_entity_1.MedField)
], Speciality.prototype, "medField", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255 }),
    __metadata("design:type", String)
], Speciality.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Speciality.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => doctor_entity_1.Doctor, (doctor) => doctor.speciality),
    __metadata("design:type", Array)
], Speciality.prototype, "doctors", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Speciality.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Speciality.prototype, "updatedAt", void 0);
exports.Speciality = Speciality = __decorate([
    (0, typeorm_1.Entity)('specialities')
], Speciality);
//# sourceMappingURL=speciality.entity.js.map