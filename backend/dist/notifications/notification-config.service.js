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
var NotificationConfigService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let NotificationConfigService = NotificationConfigService_1 = class NotificationConfigService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(NotificationConfigService_1.name);
        const raw = config.get('NOTIFICATION_OFFSETS_MINUTES', '60,1440');
        this.offsetMinutes = raw
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n) && n > 0);
        if (this.offsetMinutes.length === 0) {
            this.offsetMinutes = [60, 1440];
        }
        this.logger.log(`Notification offsets: ${this.offsetMinutes.map((m) => `${m}min`).join(', ')}`);
    }
    get schedulerIntervalMinutes() {
        return this.config.get('NOTIFICATION_SCHEDULER_INTERVAL_MINUTES', 30);
    }
    get toleranceMinutes() {
        return Math.ceil(this.schedulerIntervalMinutes / 2) + 2;
    }
};
exports.NotificationConfigService = NotificationConfigService;
exports.NotificationConfigService = NotificationConfigService = NotificationConfigService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], NotificationConfigService);
//# sourceMappingURL=notification-config.service.js.map