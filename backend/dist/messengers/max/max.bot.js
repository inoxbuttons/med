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
var MaxBot_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaxBot = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("../../chat/chat.service");
const messenger_contact_service_1 = require("../messenger-contact.service");
const clinic_net_config_service_1 = require("../../clinic-config/clinic-net-config.service");
class MaxBotInstance {
    constructor(cfg, chatService, contactService, logger) {
        this.cfg = cfg;
        this.chatService = chatService;
        this.contactService = contactService;
        this.logger = logger;
        this.lastEventId = 0;
        this.polling = false;
        this.sessions = new Map();
    }
    start() {
        this.polling = true;
        this.poll();
        this.logger.log(`[${this.cfg.clinicNetName}] MAX bot started → ${this.cfg.maxBotApiUrl}`);
    }
    stop() {
        this.polling = false;
    }
    async sendText(chatId, text) {
        const res = await fetch(`${this.cfg.maxBotApiUrl}/messages/sendText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: this.cfg.maxBotToken, chatId, text }),
        });
        if (!res.ok)
            throw new Error(`MAX sendText → ${res.status}`);
    }
    async poll() {
        while (this.polling) {
            try {
                const url = `${this.cfg.maxBotApiUrl}/events/get?token=${this.cfg.maxBotToken}&pollTime=25&lastEventId=${this.lastEventId}`;
                const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
                if (!res.ok)
                    throw new Error(`MAX poll → ${res.status}`);
                const data = await res.json();
                for (const upd of data.events ?? []) {
                    if (upd.eventId > this.lastEventId)
                        this.lastEventId = upd.eventId;
                    if (upd.type === 'newMessage' && upd.payload.text) {
                        await this.handleUpdate(upd).catch((err) => this.logger.error(`[${this.cfg.clinicNetName}] MAX update error: ${err}`));
                    }
                }
            }
            catch (err) {
                this.logger.error(`[${this.cfg.clinicNetName}] MAX poll error: ${err}`);
                await sleep(5000);
            }
        }
    }
    async handleUpdate(upd) {
        const chatId = upd.payload.chat.chatId;
        const text = upd.payload.text ?? '';
        const session = this.getSession(chatId);
        if (text.trim() === '/start') {
            await this.handleStart(chatId);
            return;
        }
        if (session.state === 'awaiting_phone') {
            await this.handlePhone(chatId, text);
            return;
        }
        await this.handleChat(chatId, text, session.clientId);
    }
    async handleStart(chatId) {
        const existing = await this.contactService.findContact(this.cfg.clinicNetId, 'max', chatId);
        if (existing?.personId) {
            this.setSession(chatId, { state: 'active', clientId: existing.personId });
            await this.sendText(chatId, 'Добро пожаловать! Я помогу записаться к врачу.\n\nЧем могу помочь?');
        }
        else {
            this.setSession(chatId, { state: 'awaiting_phone' });
            await this.sendText(chatId, 'Добро пожаловать! Для идентификации введите номер телефона (например: +79991234567):');
        }
    }
    async handlePhone(chatId, phone) {
        const person = await this.contactService.findPersonByPhone(phone);
        if (person) {
            await this.contactService.linkContact(this.cfg.clinicNetId, 'max', chatId, person.id);
            this.setSession(chatId, { state: 'active', clientId: person.id });
            await this.sendText(chatId, `Отлично, ${person.firstName}! Вы идентифицированы.\n\nЧем могу помочь?`);
        }
        else {
            await this.contactService.linkContact(this.cfg.clinicNetId, 'max', chatId, null);
            this.setSession(chatId, { state: 'active' });
            await this.sendText(chatId, 'Номер не найден. Продолжаем без идентификации.\n\nЧем могу помочь?');
        }
    }
    async handleChat(chatId, text, clientId) {
        try {
            const response = await this.chatService.sendMessage({
                sessionId: `max:${this.cfg.clinicNetId}:${chatId}`,
                message: text,
                provider: 'gigachat',
                clientId,
                clinicNetId: this.cfg.clinicNetId,
                misType: this.cfg.misType,
            });
            await this.sendText(chatId, response.reply);
        }
        catch (err) {
            this.logger.error(`[${this.cfg.clinicNetName}] chat error ${chatId}: ${err}`);
            await this.sendText(chatId, 'Произошла ошибка. Попробуйте ещё раз.');
        }
    }
    getSession(chatId) {
        if (!this.sessions.has(chatId))
            this.sessions.set(chatId, { state: 'active' });
        return this.sessions.get(chatId);
    }
    setSession(chatId, s) { this.sessions.set(chatId, s); }
}
let MaxBot = MaxBot_1 = class MaxBot {
    constructor(configService, chatService, contactService) {
        this.configService = configService;
        this.chatService = chatService;
        this.contactService = contactService;
        this.logger = new common_1.Logger(MaxBot_1.name);
        this.instances = new Map();
    }
    onModuleInit() {
        const configs = this.configService.getAllConfigs();
        for (const cfg of configs) {
            if (!cfg.maxBotToken) {
                this.logger.debug(`[${cfg.clinicNetName}] no MAX token — skipped`);
                continue;
            }
            const instance = new MaxBotInstance(cfg, this.chatService, this.contactService, this.logger);
            instance.start();
            this.instances.set(cfg.clinicNetId, instance);
        }
        if (this.instances.size === 0) {
            this.logger.warn('No MAX bots started — set MAX_BOT_TOKEN or configure clinic_net_configs');
        }
    }
    onModuleDestroy() {
        for (const instance of this.instances.values())
            instance.stop();
    }
    async sendNotification(clinicNetId, chatId, text) {
        const instance = this.instances.get(clinicNetId);
        if (!instance)
            throw new Error(`No MAX bot for clinicNetId=${clinicNetId}`);
        await instance.sendText(chatId, text);
    }
};
exports.MaxBot = MaxBot;
exports.MaxBot = MaxBot = MaxBot_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [clinic_net_config_service_1.ClinicNetConfigService,
        chat_service_1.ChatService,
        messenger_contact_service_1.MessengerContactService])
], MaxBot);
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
//# sourceMappingURL=max.bot.js.map