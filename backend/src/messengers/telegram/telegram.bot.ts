import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { ChatService } from '../../chat/chat.service';
import { MessengerContactService } from '../messenger-contact.service';
import { ClinicNetConfigService, ResolvedClinicConfig } from '../../clinic-config/clinic-net-config.service';

type TgSessionState = 'active' | 'awaiting_phone';

interface TgSession {
  state: TgSessionState;
  clientId?: number;
}

/** Один экземпляр Telegraf-бота для одной клинической сети */
class TelegramBotInstance {
  private readonly bot: Telegraf;
  private readonly sessions = new Map<string, TgSession>();

  constructor(
    private readonly cfg: ResolvedClinicConfig,
    private readonly chatService: ChatService,
    private readonly contactService: MessengerContactService,
    private readonly logger: Logger,
  ) {
    this.bot = new Telegraf(cfg.telegramBotToken!);
    this.registerHandlers();
  }

  start() {
    this.bot.launch().catch((err) =>
      this.logger.error(`[${this.cfg.clinicNetName}] Telegram launch error: ${err}`),
    );
    this.logger.log(`[${this.cfg.clinicNetName}] Telegram bot started`);
  }

  stop() {
    this.bot.stop('SIGTERM');
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }

  private registerHandlers() {
    this.bot.start(async (ctx) => {
      const chatId = String(ctx.chat.id);
      const existing = await this.contactService.findContact(this.cfg.clinicNetId, 'telegram', chatId);

      if (existing?.personId) {
        this.setSession(chatId, { state: 'active', clientId: existing.personId });
        await ctx.reply('Добро пожаловать! Я помогу вам записаться к врачу.\n\nЧто вас интересует?');
      } else {
        this.setSession(chatId, { state: 'awaiting_phone' });
        await ctx.reply(
          'Добро пожаловать! Я помогу вам записаться к врачу.\n\n' +
          'Пожалуйста, введите ваш номер телефона (например: +79991234567):',
        );
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
      } else {
        await this.handleChat(ctx, chatId, ctx.message.text, session.clientId);
      }
    });

    this.bot.catch((err, ctx) => {
      this.logger.error(`[${this.cfg.clinicNetName}] Telegram error ${ctx.chat?.id}: ${err}`);
    });
  }

  private async handlePhoneInput(ctx: Context, chatId: string, phone: string) {
    const person = await this.contactService.findPersonByPhone(phone);
    if (person) {
      await this.contactService.linkContact(this.cfg.clinicNetId, 'telegram', chatId, person.id);
      this.setSession(chatId, { state: 'active', clientId: person.id });
      await ctx.reply(`Отлично, ${person.firstName}! Вы идентифицированы.\n\nЧем могу помочь?`);
    } else {
      await this.contactService.linkContact(this.cfg.clinicNetId, 'telegram', chatId, null);
      this.setSession(chatId, { state: 'active' });
      await ctx.reply('Номер не найден. Продолжаем без идентификации.\n\nЧем могу помочь?');
    }
  }

  private async handleChat(ctx: Context, chatId: string, text: string, clientId?: number) {
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
    } catch (err) {
      this.logger.error(`[${this.cfg.clinicNetName}] chat error ${chatId}: ${err}`);
      await ctx.reply('Произошла ошибка. Попробуйте ещё раз.');
    }
  }

  private async safeReply(ctx: Context, text: string): Promise<void> {
    try {
      await ctx.reply(text, { parse_mode: 'Markdown' });
    } catch {
      await ctx.reply(text);
    }
  }

  private getSession(chatId: string): TgSession {
    if (!this.sessions.has(chatId)) this.sessions.set(chatId, { state: 'active' });
    return this.sessions.get(chatId)!;
  }

  private setSession(chatId: string, s: TgSession) {
    this.sessions.set(chatId, s);
  }
}

/**
 * TelegramBot — NestJS-сервис, который при старте запускает по одному
 * Telegraf-боту для каждой клинической сети с настроенным токеном.
 */
@Injectable()
export class TelegramBot implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBot.name);
  private readonly instances = new Map<number, TelegramBotInstance>();

  constructor(
    private readonly configService: ClinicNetConfigService,
    private readonly chatService: ChatService,
    private readonly contactService: MessengerContactService,
  ) {}

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
    for (const instance of this.instances.values()) instance.stop();
  }

  async sendNotification(clinicNetId: number, chatId: string, text: string): Promise<void> {
    const instance = this.instances.get(clinicNetId);
    if (!instance) throw new Error(`No Telegram bot for clinicNetId=${clinicNetId}`);
    await instance.sendMessage(chatId, text);
  }
}

function splitMessage(text: string, maxLength = 4096): string[] {
  if (text.length <= maxLength) return [text];
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) parts.push(text.slice(i, i + maxLength));
  return parts;
}
