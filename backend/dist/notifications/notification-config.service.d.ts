import { ConfigService } from '@nestjs/config';
export declare class NotificationConfigService {
    private readonly config;
    private readonly logger;
    readonly offsetMinutes: number[];
    constructor(config: ConfigService);
    get schedulerIntervalMinutes(): number;
    get toleranceMinutes(): number;
}
