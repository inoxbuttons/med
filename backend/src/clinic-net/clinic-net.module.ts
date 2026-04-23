import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicNet } from '../database/entities/clinic-net.entity';
import { ClinicNetService } from './clinic-net.service';
import { ClinicNetController } from './clinic-net.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClinicNet])],
  controllers: [ClinicNetController],
  providers: [ClinicNetService],
  exports: [ClinicNetService],
})
export class ClinicNetModule {}
