"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialogModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const mis_adapters_module_1 = require("../../adapters/mis/mis-adapters.module");
const mis_registry_service_1 = require("../../adapters/mis/mis-registry.service");
const token_usage_entity_1 = require("../../database/entities/token-usage.entity");
const llm_module_1 = require("../../llm/llm.module");
const catalog_module_1 = require("../catalog/catalog.module");
const catalog_search_service_1 = require("../catalog/catalog-search.service");
const nlu_service_1 = require("../nlu/nlu.service");
const clinic_profile_service_1 = require("../profile/clinic-profile.service");
const answer_service_1 = require("./answer.service");
const dialog_engine_service_1 = require("./dialog-engine.service");
const pipeline_chat_service_1 = require("./pipeline-chat.service");
let DialogModule = class DialogModule {
};
exports.DialogModule = DialogModule;
exports.DialogModule = DialogModule = __decorate([
    (0, common_1.Module)({
        imports: [llm_module_1.LlmModule, catalog_module_1.CatalogModule, mis_adapters_module_1.MisAdaptersModule, typeorm_1.TypeOrmModule.forFeature([token_usage_entity_1.TokenUsage])],
        providers: [
            nlu_service_1.NluService,
            answer_service_1.AnswerService,
            {
                provide: dialog_engine_service_1.DialogEngine,
                inject: [nlu_service_1.NluService, answer_service_1.AnswerService, catalog_search_service_1.CatalogSearch, mis_registry_service_1.MisRegistry, clinic_profile_service_1.ClinicProfileService, (0, typeorm_1.getRepositoryToken)(token_usage_entity_1.TokenUsage)],
                useFactory: (nlu, answers, search, mis, profiles, usage) => new dialog_engine_service_1.DialogEngine({
                    nlu,
                    answers,
                    search,
                    adapters: (netId, opts) => mis.forNet(netId, opts),
                    profile: (netId) => profiles.forNet(netId),
                    onUsage: (session, task, u, promptHash) => {
                        usage
                            .save({
                            clinicNetId: session.clinicNetId,
                            sessionId: session.id,
                            provider: session.provider,
                            promptTokens: u.promptTokens,
                            completionTokens: u.completionTokens,
                            totalTokens: u.totalTokens,
                            task,
                            promptHash: promptHash ?? null,
                        })
                            .catch(() => undefined);
                    },
                }),
            },
            pipeline_chat_service_1.PipelineChatService,
        ],
        exports: [pipeline_chat_service_1.PipelineChatService, nlu_service_1.NluService],
    })
], DialogModule);
//# sourceMappingURL=dialog.module.js.map