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
var TelegramBot_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramBot = void 0;
const common_1 = require("@nestjs/common");
const telegraf_1 = require("telegraf");
const chat_service_1 = require("../../chat/chat.service");
const messenger_contact_service_1 = require("../messenger-contact.service");
const clinic_net_config_service_1 = require("../../clinic-config/clinic-net-config.service");
class TelegramBotInstance {
    constructor(cfg, chatService, contactService, logger) {
        this.cfg = cfg;
        this.chatService = chatService;
        this.contactService = contactService;
        this.logger = logger;
        this.sessions = new Map();
        this.bot = new telegraf_1.Telegraf(cfg.telegramBotToken);
        this.registerHandlers();
    }
    start() {
        this.bot.launch().catch((err) => this.logger.error(`[${this.cfg.clinicNetName}] Telegram launch error: ${err}`));
        this.logger.log(`[${this.cfg.clinicNetName}] Telegram bot started`);
    }
    stop() {
        this.bot.stop('SIGTERM');
    }
    async sendMessage(chatId, text) {
        await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    }
    registerHandlers() {
        this.bot.start(async (ctx) => {
            const chatId = String(ctx.chat.id);
            const existing = await this.contactService.findContact(this.cfg.clinicNetId, 'telegram', chatId);
            if (existing?.personId) {
                this.setSession(chatId, { state: 'active', clientId: existing.personId });
                await ctx.reply('Добро пожаловать! Я помогу вам записаться к врачу.\n\nЧто вас интересует?');
            }
            else {
                this.setSession(chatId, { state: 'awaiting_phone' });
                await ctx.reply('Добро пожаловать! Я помогу вам записаться к врачу.\n\n' +
                    'Пожалуйста, введите ваш номер телефона (например: +79991234567):');
            }
        });
        this.bot.on('contact', async (ctx) => {
            await this.handlePhoneInput(ctx, String(ctx.chat.id), ctx.message.contact.phone_number);
        });
        this.bot.on('text', async (ctx) => {
            const chatId = String(ctx.chat.id);
            const session = this.getSession(chatId);
            if (session.state === 'awaiting_phone') {
                await this.handlePhoneInput(ctx, chatId, ctx.message.text);
            }
            else {
                await this.handleChat(ctx, chatId, ctx.message.text, session.clientId);
            }
        });
        this.bot.catch((err, ctx) => {
            this.logger.error(`[${this.cfg.clinicNetName}] Telegram error ${ctx.chat?.id}: ${err}`);
        });
    }
    async handlePhoneInput(ctx, chatId, phone) {
        const person = await this.contactService.findPersonByPhone(phone);
        if (person) {
            await this.contactService.linkContact(this.cfg.clinicNetId, 'telegram', chatId, person.id);
            this.setSession(chatId, { state: 'active', clientId: person.id });
            await ctx.reply(`Отлично, ${person.firstName}! Вы идентифицированы.\n\nЧем могу помочь?`);
        }
        else {
            await this.contactService.linkContact(this.cfg.clinicNetId, 'telegram', chatId, null);
            this.setSession(chatId, { state: 'active' });
            await ctx.reply('Номер не найден. Продолжаем без идентификации.\n\nЧем могу помочь?');
        }
    }
    async handleChat(ctx, chatId, text, clientId) {
        try {
            await ctx.sendChatAction('typing');
            const response = await this.chatService.sendMessage({
                sessionId: `telegram:${this.cfg.clinicNetId}:${chatId}`,
                message: text,
                provider: 'gigachat',
                clientId,
                clinicNetId: this.cfg.clinicNetId,
                misType: this.cfg.misType,
            });
            for (const chunk of splitMessage(response.reply)) {
                await this.safeReply(ctx, chunk);
            }
        }
        catch (err) {
            this.logger.error(`[${this.cfg.clinicNetName}] chat error ${chatId}: ${err}`);
            await ctx.reply('Произошла ошибка. Попробуйте ещё раз.');
        }
    }
    async safeReply(ctx, text) {
        try {
            await ctx.reply(text, { parse_mode: 'Markdown' });
        }
        catch {
            await ctx.reply(text);
        }
    }
    getSession(chatId) {
        if (!this.sessions.has(chatId))
            this.sessions.set(chatId, { state: 'active' });
        return this.sessions.get(chatId);
    }
    setSession(chatId, s) {
        this.sessions.set(chatId, s);
    }
}
let TelegramBot = TelegramBot_1 = class TelegramBot {
    constructor(configService, chatService, contactService) {
        this.configService = configService;
        this.chatService = chatService;
        this.contactService = contactService;
        this.logger = new common_1.Logger(TelegramBot_1.name);
        this.instances = new Map();
    }
    onModuleInit() {
        const configs = this.configService.getAllConfigs();
        for (const cfg of configs) {
            if (!cfg.telegramBotToken) {
                this.logger.debug(`[${cfg.clinicNetName}] no Telegram token — skipped`);
                continue;
            }
            const instance = new TelegramBotInstance(cfg, this.chatService, this.contactService, this.logger);
            instance.start();
            this.instances.set(cfg.clinicNetId, instance);
        }
        if (this.instances.size === 0) {
            this.logger.warn('No Telegram bots started — set TELEGRAM_BOT_TOKEN or configure clinic_net_configs');
        }
    }
    onModuleDestroy() {
        for (const instance of this.instances.values())
            instance.stop();
    }
    async sendNotification(clinicNetId, chatId, text) {
        const instance = this.instances.get(clinicNetId);
        if (!instance)
            throw new Error(`No Telegram bot for clinicNetId=${clinicNetId}`);
        await instance.sendMessage(chatId, text);
    }
};
exports.TelegramBot = TelegramBot;
exports.TelegramBot = TelegramBot = TelegramBot_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [clinic_net_config_service_1.ClinicNetConfigService,
        chat_service_1.ChatService,
        messenger_contact_service_1.MessengerContactService])
], TelegramBot);
function splitMessage(text, maxLength = 4096) {
    if (text.length <= maxLength)
        return [text];
    const parts = [];
    for (let i = 0; i < text.length; i += maxLength)
        parts.push(text.slice(i, i + maxLength));
    return parts;
}
//# sourceMappingURL=telegram.bot.js.map