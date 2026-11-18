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
exports.PipelineChatService = void 0;
const common_1 = require("@nestjs/common");
const session_store_port_1 = require("../ports/session-store.port");
const clinic_profile_service_1 = require("../profile/clinic-profile.service");
const dialog_engine_service_1 = require("./dialog-engine.service");
const dialog_state_1 = require("./dialog-state");
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 2000;
let PipelineChatService = class PipelineChatService {
    constructor(engine, profiles) {
        this.engine = engine;
        this.profiles = profiles;
        this.store = new session_store_port_1.InMemorySessionStore();
    }
    onModuleInit() {
        this.timer = setInterval(() => void this.store.evictOlderThan(SESSION_TTL_MS), 10 * 60 * 1000);
        this.timer.unref?.();
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async handle(dto, opts) {
        const message = (dto.message ?? '').slice(0, MAX_MESSAGE_LENGTH);
        let session = await this.store.get(dto.sessionId);
        if (!session || session.clinicNetId !== dto.clinicNetId) {
            const profile = this.profiles.forNet(dto.clinicNetId);
            session = {
                id: dto.sessionId,
                clinicNetId: dto.clinicNetId,
                provider: profile.llm.provider ?? dto.provider ?? opts.defaultProvider,
                model: profile.llm.model ?? dto.model,
                state: (0, dialog_state_1.emptyState)(),
                messages: [],
                updatedAt: Date.now(),
            };
        }
        if (dto.clientId !== undefined)
            session.clientId = dto.clientId;
        if (dto.townId !== undefined)
            session.townId = dto.townId;
        if (opts.patient && !session.patient)
            session.patient = opts.patient;
        const reply = await this.engine.handle(session, { text: message, payload: dto.payload });
        await this.store.set(session.id, session);
        return {
            sessionId: session.id,
            reply: reply.text,
            quickReplies: reply.quickReplies,
            history: session.messages,
            engine: 'pipeline',
        };
    }
    async history(sessionId) {
        const s = await this.store.get(sessionId);
        return s ? s.messages : null;
    }
    async clear(sessionId) {
        await this.store.delete(sessionId);
    }
};
exports.PipelineChatService = PipelineChatService;
exports.PipelineChatService = PipelineChatService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [dialog_engine_service_1.DialogEngine,
        clinic_profile_service_1.ClinicProfileService])
], PipelineChatService);
//# sourceMappingURL=pipeline-chat.service.js.map