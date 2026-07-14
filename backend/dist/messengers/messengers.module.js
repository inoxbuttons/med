"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessengersModule = void 0;
const common_1 = require("@nestjs/common");
const telegram_module_1 = require("./telegram/telegram.module");
const max_module_1 = require("./max/max.module");
let MessengersModule = class MessengersModule {
};
exports.MessengersModule = MessengersModule;
exports.MessengersModule = MessengersModule = __decorate([
    (0, common_1.Module)({
        imports: [telegram_module_1.TelegramModule, max_module_1.MaxModule],
        exports: [telegram_module_1.TelegramModule, max_module_1.MaxModule],
    })
], MessengersModule);
//# sourceMappingURL=messengers.module.js.map