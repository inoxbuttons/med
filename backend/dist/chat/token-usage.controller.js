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
exports.TokenUsageController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const token_usage_entity_1 = require("../database/entities/token-usage.entity");
let TokenUsageController = class TokenUsageController {
    constructor(repo) {
        this.repo = repo;
    }
    async getUsage(year, month, clinicNetId) {
        const qb = this.repo
            .createQueryBuilder('t')
            .leftJoin('t.clinicNet', 'cn')
            .select("to_char(date_trunc('month', t.created_at), 'YYYY-MM')", 'month')
            .addSelect('t.clinic_net_id', 'clinicNetId')
            .addSelect('cn.name', 'clinicNetName')
            .addSelect('SUM(t.prompt_tokens)::int', 'promptTokens')
            .addSelect('SUM(t.completion_tokens)::int', 'completionTokens')
            .addSelect('SUM(t.total_tokens)::int', 'totalTokens')
            .addSelect('COUNT(*)::int', 'calls')
            .groupBy('month')
            .addGroupBy('t.clinic_net_id')
            .addGroupBy('cn.name')
            .orderBy('month', 'DESC')
            .addOrderBy('t.clinic_net_id', 'ASC');
        if (year) {
            qb.andWhere("EXTRACT(YEAR FROM t.created_at) = :year", { year: Number(year) });
        }
        if (month) {
            qb.andWhere("EXTRACT(MONTH FROM t.created_at) = :month", { month: Number(month) });
        }
        if (clinicNetId) {
            qb.andWhere('t.clinic_net_id = :clinicNetId', { clinicNetId: Number(clinicNetId) });
        }
        return qb.getRawMany();
    }
};
exports.TokenUsageController = TokenUsageController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('year')),
    __param(1, (0, common_1.Query)('month')),
    __param(2, (0, common_1.Query)('clinicNetId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], TokenUsageController.prototype, "getUsage", null);
exports.TokenUsageController = TokenUsageController = __decorate([
    (0, common_1.Controller)('admin/token-usage'),
    __param(0, (0, typeorm_1.InjectRepository)(token_usage_entity_1.TokenUsage)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TokenUsageController);
//# sourceMappingURL=token-usage.controller.js.map