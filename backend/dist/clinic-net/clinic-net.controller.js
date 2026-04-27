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
exports.ClinicNetController = void 0;
const common_1 = require("@nestjs/common");
const clinic_net_service_1 = require("./clinic-net.service");
let ClinicNetController = class ClinicNetController {
    constructor(clinicNetService) {
        this.clinicNetService = clinicNetService;
    }
};
exports.ClinicNetController = ClinicNetController;
exports.ClinicNetController = ClinicNetController = __decorate([
    (0, common_1.Controller)('clinic-net'),
    __metadata("design:paramtypes", [clinic_net_service_1.ClinicNetService])
], ClinicNetController);
//# sourceMappingURL=clinic-net.controller.js.map