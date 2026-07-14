import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChatService } from '../../chat/chat.service';
import { MessengerContactService } from '../messenger-contact.service';
import { ClinicNetConfigService } from '../../clinic-config/clinic-net-config.service';
export declare class TelegramBot implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly chatService;
    private readonly contactService;
    private readonly logger;
    private readonly instances;
    constructor(configService: ClinicNetConfigService, chatService: ChatService, contactService: MessengerContactService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    sendNotification(clinicNetId: number, chatId: string, text: string): Promise<void>;
}
