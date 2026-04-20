import { Module } from '@nestjs/common';
import { InfclinicaService } from './infoclinica.service';

@Module({
  providers: [InfclinicaService],
  exports: [InfclinicaService],
})
export class InfclinicaModule {}
