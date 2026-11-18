import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto, SendMessageResponse, ChatMessage } from './chat.types';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Отправить сообщение и получить ответ
  @Post('message')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() dto: SendMessageDto): Promise<SendMessageResponse> {
    return this.chatService.sendMessage(dto);
  }

  // Получить историю сессии
  @Get('history/:sessionId')
  getHistory(@Param('sessionId') sessionId: string): Promise<ChatMessage[]> {
    return this.chatService.getHistory(sessionId);
  }

  // Очистить сессию
  @Delete('session/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearSession(@Param('sessionId') sessionId: string): Promise<void> {
    await this.chatService.clearSession(sessionId);
  }
}
