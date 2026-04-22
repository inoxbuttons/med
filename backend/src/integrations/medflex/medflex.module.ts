import { Module } from '@nestjs/common';
import { MedflexService } from './medflex.service';

@Module({
  providers: [MedflexService],
  exports: [MedflexService],
})
export class MedflexModule {}
