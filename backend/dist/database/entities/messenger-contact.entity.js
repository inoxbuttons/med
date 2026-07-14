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
exports.MessengerContact = void 0;
const typeorm_1 = require("typeorm");
const person_entity_1 = require("./person.entity");
const clinic_net_entity_1 = require("./clinic-net.entity");
let MessengerContact = class MessengerContact {
};
exports.MessengerContact = MessengerContact;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], MessengerContact.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'clinic_net_id' }),
    __metadata("design:type", Number)
], MessengerContact.prototype, "clinicNetId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'person_id', nullable: true }),
    __metadata("design:type", Number)
], MessengerContact.prototype, "personId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 32 }),
    __metadata("design:type", String)
], MessengerContact.prototype, "messenger", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chat_id', length: 128 }),
    __metadata("design:type", String)
], MessengerContact.prototype, "chatId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => clinic_net_entity_1.ClinicNet, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'clinic_net_id' }),
    __metadata("design:type", clinic_net_entity_1.ClinicNet)
], MessengerContact.prototype, "clinicNet", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => person_entity_1.Person, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'person_id' }),
    __metadata("design:type", person_entity_1.Person)
], MessengerContact.prototype, "person", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MessengerContact.prototype, "createdAt", void 0);
exports.MessengerContact = MessengerContact = __decorate([
    (0, typeorm_1.Entity)('messenger_contacts'),
    (0, typeorm_1.Unique)(['clinicNetId', 'messenger', 'chatId'])
], MessengerContact);
//# sourceMappingURL=messenger-contact.entity.js.map