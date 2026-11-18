import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChatMessage, LlmProvider, PatientData, SendMessageDto, SendMessageResponse } from '../../chat/chat.types';
import { ClinicProfileService } from '../profile/clinic-profile.service';
import { DialogEngine } from './dialog-engine.service';
export declare class PipelineChatService implements OnModuleInit, OnModuleDestroy {
    private readonly engine;
    private readonly profiles;
    private readonly store;
    private timer?;
    constructor(engine: DialogEngine, profiles: ClinicProfileService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    handle(dto: SendMessageDto & {
        clinicNetId: number;
    }, opts: {
        patient?: PatientData;
        defaultProvider: LlmProvider;
    }): Promise<SendMessageResponse>;
    history(sessionId: string): Promise<ChatMessage[] | null>;
    clear(sessionId: string): Promise<void>;
}
