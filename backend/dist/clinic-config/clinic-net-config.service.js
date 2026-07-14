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
var ClinicNetConfigService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicNetConfigService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const clinic_net_entity_1 = require("../database/entities/clinic-net.entity");
let ClinicNetConfigService = ClinicNetConfigService_1 = class ClinicNetConfigService {
    constructor(clinicNetRepo, env) {
        this.clinicNetRepo = clinicNetRepo;
        this.env = env;
        this.logger = new common_1.Logger(ClinicNetConfigService_1.name);
        this.configs = new Map();
    }
    async onModuleInit() {
        await this.reload();
    }
    async reload() {
        const nets = await this.clinicNetRepo.find();
        this.configs.clear();
        const envDefaults = this.envDefaults();
        for (const net of nets) {
            this.configs.set(net.id, {
                clinicNetId: net.id,
                clinicNetName: net.name,
                misType: net.mis ?? null,
                medflexApiToken: net.medflexKey ?? envDefaults.medflexApiToken,
                medflexTriggerUrl: envDefaults.medflexTriggerUrl,
                telegramBotToken: net.telegramBotToken ?? envDefaults.telegramBotToken,
                maxBotToken: net.maxBotToken ?? envDefaults.maxBotToken,
                maxBotApiUrl: net.maxBotApiUrl || envDefaults.maxBotApiUrl,
            });
        }
        this.logger.log(`Loaded configs for ${this.configs.size} clinic net(s)`);
    }
    getConfig(clinicNetId) {
        return this.configs.get(clinicNetId);
    }
    getAllConfigs() {
        return [...this.configs.values()];
    }
    envDefaults() {
        return {
            medflexApiToken: this.env.get('MEDFLEX_API_TOKEN') ?? null,
            medflexTriggerUrl: this.env.get('MEDFLEX_TRIGGER_URL', 'https://api.medflex.ru'),
            telegramBotToken: this.env.get('TELEGRAM_BOT_TOKEN') ?? null,
            maxBotToken: this.env.get('MAX_BOT_TOKEN') ?? null,
            maxBotApiUrl: this.env.get('MAX_BOT_API_URL', 'https://myteam.mail.ru/bot/v1'),
        };
    }
};
exports.ClinicNetConfigService = ClinicNetConfigService;
exports.ClinicNetConfigService = ClinicNetConfigService = ClinicNetConfigService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(clinic_net_entity_1.ClinicNet)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], ClinicNetConfigService);
//# sourceMappingURL=clinic-net-config.service.js.map