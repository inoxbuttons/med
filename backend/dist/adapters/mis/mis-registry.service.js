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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MisRegistry = void 0;
exports.toMisKind = toMisKind;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const clinic_net_entity_1 = require("../../database/entities/clinic-net.entity");
const infoclinica_service_1 = require("../../integrations/infoclinica/infoclinica.service");
const local_db_service_1 = require("../../integrations/local/local-db.service");
const medflex_service_1 = require("../../integrations/medflex/medflex.service");
const infoclinica_adapters_1 = require("./infoclinica/infoclinica.adapters");
const local_booking_adapter_1 = require("./local/local-booking.adapter");
const local_catalog_source_1 = require("./local/local-catalog.source");
const medflex_booking_adapter_1 = require("./medflex/medflex-booking.adapter");
const medflex_catalog_source_1 = require("./medflex/medflex-catalog.source");
let MisRegistry = class MisRegistry {
    constructor(nets, db, local, medflex, infoclinica) {
        this.nets = nets;
        this.db = db;
        this.local = local;
        this.medflex = medflex;
        this.infoclinica = infoclinica;
    }
    async misOf(clinicNetId) {
        const net = await this.nets.findOne({ where: { id: clinicNetId } });
        if (!net)
            throw new common_1.NotFoundException(`Сеть клиник ${clinicNetId} не найдена`);
        return toMisKind(net.mis);
    }
    async forNet(clinicNetId, opts = {}) {
        const net = await this.nets.findOne({ where: { id: clinicNetId } });
        if (!net)
            throw new common_1.NotFoundException(`Сеть клиник ${clinicNetId} не найдена`);
        const mis = toMisKind(net.mis);
        if (mis === 'medflex') {
            const resolved = this.medflex.clientFor(net.medflexKey, clinicNetId);
            if (!resolved)
                throw new Error(`MedFlex: не настроен клиент для сети ${clinicNetId}`);
            const ctx = { client: resolved.client, lpuGroupId: resolved.lpuGroupId, townId: opts.townId };
            const catalog = new medflex_catalog_source_1.MedflexCatalogSource(clinicNetId, this.medflex, ctx);
            return { mis, catalog, booking: new medflex_booking_adapter_1.MedflexBookingAdapter(clinicNetId, this.medflex, this.local, ctx, catalog) };
        }
        if (mis === 'infoclinica') {
            return {
                mis,
                catalog: new infoclinica_adapters_1.InfoclinicaCatalogSource(clinicNetId, this.infoclinica),
                booking: new infoclinica_adapters_1.InfoclinicaBookingAdapter(clinicNetId, this.infoclinica, this.local),
            };
        }
        const catalog = new local_catalog_source_1.LocalCatalogSource(clinicNetId, this.local, this.db);
        return { mis, catalog, booking: new local_booking_adapter_1.LocalBookingAdapter(clinicNetId, this.local, catalog) };
    }
};
exports.MisRegistry = MisRegistry;
exports.MisRegistry = MisRegistry = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(clinic_net_entity_1.ClinicNet)),
    __param(1, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        local_db_service_1.LocalDbService,
        medflex_service_1.MedflexService,
        infoclinica_service_1.InfclinicaService])
], MisRegistry);
function toMisKind(mis) {
    return mis === 'medflex' || mis === 'infoclinica' ? mis : 'local';
}
//# sourceMappingURL=mis-registry.service.js.map