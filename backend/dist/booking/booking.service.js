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
var BookingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const clinic_net_entity_1 = require("../database/entities/clinic-net.entity");
const infoclinica_service_1 = require("../integrations/infoclinica/infoclinica.service");
const medflex_service_1 = require("../integrations/medflex/medflex.service");
const local_db_service_1 = require("../integrations/local/local-db.service");
let BookingService = BookingService_1 = class BookingService {
    constructor(clinicNetRepo, localDbService, infoclinicaService, medflexService) {
        this.clinicNetRepo = clinicNetRepo;
        this.localDbService = localDbService;
        this.infoclinicaService = infoclinicaService;
        this.medflexService = medflexService;
        this.logger = new common_1.Logger(BookingService_1.name);
    }
    checkPatientTimeConflict(clientId, startTime) {
        return this.localDbService.checkPatientTimeConflict(clientId, startTime);
    }
    rescheduleAppointment(params) {
        return this.localDbService.rescheduleAppointment(params);
    }
    getTools(misType, hasPatient) {
        if (misType === 'medflex')
            return this.medflexService.getTools(hasPatient);
        return this.localDbService.getTools();
    }
    async executeTool(name, args, _sessionId, clientId, misType, clinicNetId, townId, districtId, patient) {
        try {
            if (misType === 'infoclinica') {
                return this.infoclinicaService.executeTool(name, args, clientId);
            }
            if (misType === 'medflex') {
                let medflexKey = null;
                if (clinicNetId) {
                    const clinicNet = await this.clinicNetRepo.findOne({ where: { id: clinicNetId } });
                    medflexKey = clinicNet?.medflexKey ?? null;
                }
                return this.medflexService.executeTool(name, args, clientId, medflexKey, clinicNetId, townId, districtId, patient);
            }
            return this.localDbService.executeTool(name, args, clientId);
        }
        catch (err) {
            this.logger.error(`Tool ${name} error: ${String(err)}`);
            return { error: `Ошибка при выполнении ${name}. Пожалуйста, уточни данные и попробуй снова.` };
        }
    }
};
exports.BookingService = BookingService;
exports.BookingService = BookingService = BookingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(clinic_net_entity_1.ClinicNet)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        local_db_service_1.LocalDbService,
        infoclinica_service_1.InfclinicaService,
        medflex_service_1.MedflexService])
], BookingService);
//# sourceMappingURL=booking.service.js.map