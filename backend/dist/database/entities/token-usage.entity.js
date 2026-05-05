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
exports.TokenUsage = void 0;
const typeorm_1 = require("typeorm");
const clinic_net_entity_1 = require("./clinic-net.entity");
let TokenUsage = class TokenUsage {
};
exports.TokenUsage = TokenUsage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], TokenUsage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'clinic_net_id', nullable: true }),
    __metadata("design:type", Number)
], TokenUsage.prototype, "clinicNetId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => clinic_net_entity_1.ClinicNet, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'clinic_net_id' }),
    __metadata("design:type", clinic_net_entity_1.ClinicNet)
], TokenUsage.prototype, "clinicNet", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'session_id', length: 255 }),
    __metadata("design:type", String)
], TokenUsage.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 50 }),
    __metadata("design:type", String)
], TokenUsage.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'prompt_tokens' }),
    __metadata("design:type", Number)
], TokenUsage.prototype, "promptTokens", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completion_tokens' }),
    __metadata("design:type", Number)
], TokenUsage.prototype, "completionTokens", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_tokens' }),
    __metadata("design:type", Number)
], TokenUsage.prototype, "totalTokens", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], TokenUsage.prototype, "createdAt", void 0);
exports.TokenUsage = TokenUsage = __decorate([
    (0, typeorm_1.Entity)('token_usage'),
    (0, typeorm_1.Index)(['clinicNetId', 'createdAt'])
], TokenUsage);
//# sourceMappingURL=token-usage.entity.js.map