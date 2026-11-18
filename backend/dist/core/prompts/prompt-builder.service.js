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
var PromptBuilder_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptBuilder = void 0;
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const common_1 = require("@nestjs/common");
const clinic_profile_service_1 = require("../profile/clinic-profile.service");
let PromptBuilder = PromptBuilder_1 = class PromptBuilder {
    constructor(profiles, root = (0, clinic_profile_service_1.clinicsRoot)()) {
        this.profiles = profiles;
        this.root = root;
        this.logger = new common_1.Logger(PromptBuilder_1.name);
        this.cache = new Map();
    }
    build(task, target, vars = {}, opts = {}) {
        const profile = this.profiles.forNet(target.clinicNetId);
        const candidates = [
            `core/prompts/${task}.md`,
            target.mis ? `core/prompts/mis/${target.mis}/${task}.md` : null,
            profile.slug !== 'default' ? `nets/${profile.slug}/prompts/${task}.md` : null,
        ].filter(Boolean);
        const layers = [];
        const parts = [];
        candidates.forEach((rel, i) => {
            const content = i === 0 && opts.coreOverride ? opts.coreOverride : this.read(rel);
            if (content === null) {
                if (i === 0)
                    throw new Error(`Нет ядра промпта ${rel}`);
                return;
            }
            layers.push(i === 0 && opts.coreOverride ? 'env:CHAT_SYSTEM_PROMPT' : rel);
            if (content.trim())
                parts.push(content.trim());
        });
        const template = parts.join('\n\n');
        const hash = crypto.createHash('sha1').update(template).digest('hex').slice(0, 12);
        const allVars = { clinicName: profile.displayName, ...vars };
        const text = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, name) => {
            if (!(name in allVars))
                throw new Error(`Промпт ${task}: переменная {{${name}}} не передана`);
            return String(allVars[name]);
        });
        return { text, hash, layers };
    }
    clearCache() {
        this.cache.clear();
    }
    read(rel) {
        if (this.cache.has(rel))
            return this.cache.get(rel);
        const file = path.join(this.root, rel);
        const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
        this.cache.set(rel, content);
        return content;
    }
};
exports.PromptBuilder = PromptBuilder;
exports.PromptBuilder = PromptBuilder = PromptBuilder_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [clinic_profile_service_1.ClinicProfileService, String])
], PromptBuilder);
//# sourceMappingURL=prompt-builder.service.js.map