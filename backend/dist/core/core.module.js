"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreModule = void 0;
const common_1 = require("@nestjs/common");
const clinic_profile_service_1 = require("./profile/clinic-profile.service");
const prompt_builder_service_1 = require("./prompts/prompt-builder.service");
let CoreModule = class CoreModule {
};
exports.CoreModule = CoreModule;
exports.CoreModule = CoreModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            { provide: clinic_profile_service_1.ClinicProfileService, useFactory: () => new clinic_profile_service_1.ClinicProfileService() },
            { provide: prompt_builder_service_1.PromptBuilder, useFactory: (p) => new prompt_builder_service_1.PromptBuilder(p), inject: [clinic_profile_service_1.ClinicProfileService] },
        ],
        exports: [clinic_profile_service_1.ClinicProfileService, prompt_builder_service_1.PromptBuilder],
    })
], CoreModule);
//# sourceMappingURL=core.module.js.map