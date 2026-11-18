import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChatMessage, LlmProvider, PatientData, SendMessageDto, SendMessageResponse } from '../../chat/chat.types';
import { InMemorySessionStore, SessionStore } from '../ports/session-store.port';
import { ClinicProfileService } from '../profile/clinic-profile.service';
import { DialogEngine } from './dialog-engine.service';
import { DialogSession, emptyState } from './dialog-state';

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Чат на новом движке (профиль сети: engine: pipeline). API тот же, что у ChatService,
 * плюс кнопки (quickReplies) и payload нажатой кнопки.
 */
@Injectable()
export class PipelineChatService implements OnModuleInit, OnModuleDestroy {
  private readonly store: SessionStore<DialogSession> = new InMemorySessionStore<DialogSession>();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly engine: DialogEngine,
    private readonly profiles: ClinicProfileService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.store.evictOlderThan(SESSION_TTL_MS), 10 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async handle(
    dto: SendMessageDto & { clinicNetId: number },
    opts: { patient?: PatientData; defaultProvider: LlmProvider },
  ): Promise<SendMessageResponse> {
    const message = (dto.message ?? '').slice(0, MAX_MESSAGE_LENGTH);
    let session = await this.store.get(dto.sessionId);
    if (!session || session.clinicNetId !== dto.clinicNetId) {
      const profile = this.profiles.forNet(dto.clinicNetId);
      session = {
        id: dto.sessionId,
        clinicNetId: dto.clinicNetId,
        provider: profile.llm.provider ?? dto.provider ?? opts.defaultProvider,
        model: profile.llm.model ?? dto.model,
        state: emptyState(),
        messages: [],
        updatedAt: Date.now(),
      };
    }
    if (dto.clientId !== undefined) session.clientId = dto.clientId;
    if (dto.townId !== undefined) session.townId = dto.townId;
    if (opts.patient && !session.patient) session.patient = opts.patient;

    const reply = await this.engine.handle(session, { text: message, payload: dto.payload });
    await this.store.set(session.id, session);
    return {
      sessionId: session.id,
      reply: reply.text,
      quickReplies: reply.quickReplies,
      history: session.messages as ChatMessage[],
      engine: 'pipeline',
    };
  }

  async history(sessionId: string): Promise<ChatMessage[] | null> {
    const s = await this.store.get(sessionId);
    return s ? (s.messages as ChatMessage[]) : null;
  }

  async clear(sessionId: string): Promise<void> {
    await this.store.delete(sessionId);
  }
}
