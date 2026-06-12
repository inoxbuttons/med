import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Конфигурация уведомлений.
 *
 * NOTIFICATION_OFFSETS_MINUTES — список смещений (через запятую), по умолчанию "60,1440"
 * (уведомление за 1 час и за 1 день до приёма).
 *
 * В будущем: смещения можно вынести в таблицу БД и настраивать через UI.
 */
@Injectable()
export class NotificationConfigService {
  private readonly logger = new Logger(NotificationConfigService.name);
  readonly offsetMinutes: number[];

  constructor(private readonly config: ConfigService) {
    const raw = config.get<string>('NOTIFICATION_OFFSETS_MINUTES', '60,1440');
    this.offsetMinutes = raw
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);

    if (this.offsetMinutes.length === 0) {
      this.offsetMinutes = [60, 1440];
    }

    this.logger.log(
      `Notification offsets: ${this.offsetMinutes.map((m) => `${m}min`).join(', ')}`,
    );
  }

  /** Интервал запуска планировщика в минутах */
  get schedulerIntervalMinutes(): number {
    return this.config.get<number>('NOTIFICATION_SCHEDULER_INTERVAL_MINUTES', 30);
  }

  /** Допустимое отклонение при поиске записей (чтобы не пропустить на стыке интервалов) */
  get toleranceMinutes(): number {
    return Math.ceil(this.schedulerIntervalMinutes / 2) + 2;
  }
}
