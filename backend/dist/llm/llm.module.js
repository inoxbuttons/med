"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmModule = void 0;
const common_1 = require("@nestjs/common");
const openai_service_1 = require("./openai.service");
const gigachat_service_1 = require("./gigachat.service");
const qwen_service_1 = require("./qwen.service");
const qwen3_service_1 = require("./qwen3.service");
let LlmModule = class LlmModule {
};
exports.LlmModule = LlmModule;
exports.LlmModule = LlmModule = __decorate([
    (0, common_1.Module)({
        providers: [openai_service_1.OpenAiService, gigachat_service_1.GigaChatService, qwen_service_1.QwenService, qwen3_service_1.Qwen3Service],
        exports: [openai_service_1.OpenAiService, gigachat_service_1.GigaChatService, qwen_service_1.QwenService, qwen3_service_1.Qwen3Service],
    })
], LlmModule);
//# sourceMappingURL=llm.module.js.map