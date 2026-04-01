import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingService } from './booking.service';
import { Clinic } from '../database/entities/clinic.entity';
import { Doctor } from '../database/entities/doctor.entity';
import { DoctorLocation } from '../database/entities/doctor-location.entity';
import { DoctorWorkingHours } from '../database/entities/doctor-working-hours.entity';
import { DoctorException } from '../database/entities/doctor-exception.entity';
import { ServiceWorkingHours } from '../database/entities/service-working-hours.entity';
import { ServiceException } from '../database/entities/service-exception.entity';
import { ServiceAppointment } from '../database/entities/service-appointment.entity';
import { Service } from '../database/entities/service.entity';
import { ServiceByClinic } from '../database/entities/service-by-clinic.entity';
import { ServiceSchedule } from '../database/entities/service-schedule.entity';
import { Appointment } from '../database/entities/appointment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Clinic,
      Doctor,
      DoctorLocation,
      DoctorWorkingHours,
      DoctorException,
      Service,
      ServiceByClinic,
      ServiceSchedule,
      Appointment,
      ServiceWorkingHours,
      ServiceException,
      ServiceAppointment,
    ]),
  ],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
