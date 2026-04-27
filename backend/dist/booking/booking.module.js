"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const booking_service_1 = require("./booking.service");
const clinic_net_entity_1 = require("../database/entities/clinic-net.entity");
const local_db_module_1 = require("../integrations/local/local-db.module");
const infoclinica_module_1 = require("../integrations/infoclinica/infoclinica.module");
const medflex_module_1 = require("../integrations/medflex/medflex.module");
let BookingModule = class BookingModule {
};
exports.BookingModule = BookingModule;
exports.BookingModule = BookingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([clinic_net_entity_1.ClinicNet]),
            local_db_module_1.LocalDbModule,
            infoclinica_module_1.InfclinicaModule,
            medflex_module_1.MedflexModule,
        ],
        providers: [booking_service_1.BookingService],
        exports: [booking_service_1.BookingService],
    })
], BookingModule);
//# sourceMappingURL=booking.module.js.map