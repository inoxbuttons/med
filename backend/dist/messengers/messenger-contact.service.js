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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MessengerContactService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessengerContactService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const messenger_contact_entity_1 = require("../database/entities/messenger-contact.entity");
const person_entity_1 = require("../database/entities/person.entity");
let MessengerContactService = MessengerContactService_1 = class MessengerContactService {
    constructor(contactRepo, personRepo) {
        this.contactRepo = contactRepo;
        this.personRepo = personRepo;
        this.logger = new common_1.Logger(MessengerContactService_1.name);
    }
    async findContact(clinicNetId, messenger, chatId) {
        return this.contactRepo.findOne({
            where: { clinicNetId, messenger, chatId },
            relations: ['person'],
        });
    }
    async findPersonByPhone(phone) {
        const last10 = phone.replace(/\D/g, '').slice(-10);
        return this.personRepo.findOne({
            where: [
                { phone: (0, typeorm_2.ILike)(`%${last10}`) },
                { phone: (0, typeorm_2.ILike)(`%${phone.replace(/\D/g, '')}`) },
            ],
        });
    }
    async linkContact(clinicNetId, messenger, chatId, personId) {
        const existing = await this.contactRepo.findOne({ where: { clinicNetId, messenger, chatId } });
        if (existing) {
            existing.personId = personId;
            return this.contactRepo.save(existing);
        }
        const contact = this.contactRepo.create({ clinicNetId, messenger, chatId, personId });
        const saved = await this.contactRepo.save(contact);
        this.logger.log(`Linked ${messenger}:${chatId} (clinicNet=${clinicNetId}) → person_id=${personId ?? 'anonymous'}`);
        return saved;
    }
    async findContactsByPersonId(personId) {
        return this.contactRepo.find({ where: { personId } });
    }
    async findContactsByPhone(phone) {
        const person = await this.findPersonByPhone(phone);
        if (!person)
            return [];
        return this.findContactsByPersonId(person.id);
    }
};
exports.MessengerContactService = MessengerContactService;
exports.MessengerContactService = MessengerContactService = MessengerContactService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(messenger_contact_entity_1.MessengerContact)),
    __param(1, (0, typeorm_1.InjectRepository)(person_entity_1.Person)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], MessengerContactService);
//# sourceMappingURL=messenger-contact.service.js.map