import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChatService } from '../../chat/chat.service';
import { MessengerContactService } from '../messenger-contact.service';
import { ClinicNetConfigService, ResolvedClinicConfig } from '../../clinic-config/clinic-net-config.service';

interface MaxUpdate {
  eventId: number;
  type: string;
  payload: {
    chat: { chatId: string };
    from?: { userId: string; firstName?: string };
    text?: string;
  };
}

type MaxSessionState = 'active' | 'awaiting_phone';

interface MaxSession {
  state: MaxSessionState;
  clientId?: number;
}

/** Один long-polling экземпляр MAX-бота для одной клинической сети */
class MaxBotInstance {
  private lastEventId = 0;
  private polling = false;
  private readonly sessions = new Map<string, MaxSession>();

  constructor(
    private readonly cfg: ResolvedClinicConfig,
    private readonly chatService: ChatService,
    private readonly contactService: MessengerContactService,
    private readonly logger: Logger,
  ) {}

  start() {
    this.polling = true;
    this.poll();
    this.logger.log(`[${this.cfg.clinicNetName}] MAX bot started → ${this.cfg.maxBotApiUrl}`);
  }

  stop() {
    this.polling = false;
  }

  async sendText(chatId: string, text: string): Promise<void> {
    const res = await fetch(`${this.cfg.maxBotApiUrl}/messages/sendText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: this.cfg.maxBotToken, chatId, text }),
    });
    if (!res.ok) throw new Error(`MAX sendText → ${res.status}`);
  }

  private async poll() {
    while (this.polling) {
      try {
        const url = `${this.cfg.maxBotApiUrl}/events/get?token=${this.cfg.maxBotToken}&pollTime=25&lastEventId=${this.lastEventId}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`MAX poll → ${res.status}`);
        const data = await res.json() as { events?: MaxUpdate[] };

        for (const upd of data.events ?? []) {
          if (upd.eventId > this.lastEventId) this.lastEventId = upd.eventId;
          if (upd.type === 'newMessage' && upd.payload.text) {
            await this.handleUpdate(upd).catch((err) =>
              this.logger.error(`[${this.cfg.clinicNetName}] MAX update error: ${err}`),
            );
          }
        }
      } catch (err) {
        this.logger.error(`[${this.cfg.clinicNetName}] MAX poll error: ${err}`);
        await sleep(5000);
      }
    }
  }

  private async handleUpdate(upd: MaxUpdate) {
    const chatId = upd.payload.chat.chatId;
    const text   = upd.payload.text ?? '';
    const session = this.getSession(chatId);

    if (text.trim() === '/start') { await this.handleStart(chatId); return; }
    if (session.state === 'awaiting_phone') { await this.handlePhone(chatId, text); return; }
    await this.handleChat(chatId, text, session.clientId);
  }

  private async handleStart(chatId: string) {
    const existing = await this.contactService.findContact(this.cfg.clinicNetId, 'max', chatId);
    if (existing?.personId) {
      this.setSession(chatId, { state: 'active', clientId: existing.personId });
      await this.sendText(chatId, 'Добро пожаловать! Я помогу записаться к врачу.\n\nЧем могу помочь?');
    } else {
      this.setSession(chatId, { state: 'awaiting_phone' });
      await this.sendText(chatId,
        'Добро пожаловать! Для идентификации введите номер телефона (например: +79991234567):',
      );
    }
  }

  private async handlePhone(chatId: string, phone: string) {
    const person = await this.contactService.findPersonByPhone(phone);
    if (person) {
      await this.contactService.linkContact(this.cfg.clinicNetId, 'max', chatId, person.id);
      this.setSession(chatId, { state: 'active', clientId: person.id });
      await this.sendText(chatId, `Отлично, ${person.firstName}! Вы идентифицированы.\n\nЧем могу помочь?`);
    } else {
      await this.contactService.linkContact(this.cfg.clinicNetId, 'max', chatId, null);
      this.setSession(chatId, { state: 'active' });
      await this.sendText(chatId, 'Номер не найден. Продолжаем без идентификации.\n\nЧем могу помочь?');
    }
  }

  private async handleChat(chatId: string, text: string, clientId?: number) {
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
    } catch (err) {
      this.logger.error(`[${this.cfg.clinicNetName}] chat error ${chatId}: ${err}`);
      await this.sendText(chatId, 'Произошла ошибка. Попробуйте ещё раз.');
    }
  }

  private getSession(chatId: string): MaxSession {
    if (!this.sessions.has(chatId)) this.sessions.set(chatId, { state: 'active' });
    return this.sessions.get(chatId)!;
  }

  private setSession(chatId: string, s: MaxSession) { this.sessions.set(chatId, s); }
}

@Injectable()
export class MaxBot implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaxBot.name);
  private readonly instances = new Map<number, MaxBotInstance>();

  constructor(
    private readonly configService: ClinicNetConfigService,
    private readonly chatService: ChatService,
    private readonly contactService: MessengerContactService,
  ) {}

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
    for (const instance of this.instances.values()) instance.stop();
  }

  async sendNotification(clinicNetId: number, chatId: string, text: string): Promise<void> {
    const instance = this.instances.get(clinicNetId);
    if (!instance) throw new Error(`No MAX bot for clinicNetId=${clinicNetId}`);
    await instance.sendText(chatId, text);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
