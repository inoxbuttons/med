import { Module } from '@nestjs/common';
import { TelegramModule } from './telegram/telegram.module';
import { MaxModule } from './max/max.module';

@Module({
  imports: [TelegramModule, MaxModule],
  exports: [TelegramModule, MaxModule],
})
export class MessengersModule {}
