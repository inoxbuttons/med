import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicNet } from '../../database/entities/clinic-net.entity';
import { InfclinicaModule } from '../../integrations/infoclinica/infoclinica.module';
import { LocalDbModule } from '../../integrations/local/local-db.module';
import { MedflexModule } from '../../integrations/medflex/medflex.module';
import { MisRegistry } from './mis-registry.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClinicNet]), LocalDbModule, MedflexModule, InfclinicaModule],
  providers: [MisRegistry],
  exports: [MisRegistry],
})
export class MisAdaptersModule {}
