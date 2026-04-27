import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingService } from './booking.service';
import { ClinicNet } from '../database/entities/clinic-net.entity';
import { LocalDbModule } from '../integrations/local/local-db.module';
import { InfclinicaModule } from '../integrations/infoclinica/infoclinica.module';
import { MedflexModule } from '../integrations/medflex/medflex.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClinicNet]),
    LocalDbModule,
    InfclinicaModule,
    MedflexModule,
  ],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
