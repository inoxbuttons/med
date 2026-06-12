import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicNet } from '../database/entities/clinic-net.entity';
import { ClinicNetConfigService } from './clinic-net-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClinicNet])],
  providers: [ClinicNetConfigService],
  exports: [ClinicNetConfigService],
})
export class ClinicConfigModule {}
