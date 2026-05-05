import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClinicNet } from './entities/clinic-net.entity';
import { Clinic } from './entities/clinic.entity';
import { MedField } from './entities/med-field.entity';
import { Speciality } from './entities/speciality.entity';
import { Doctor } from './entities/doctor.entity';
import { DoctorLocation } from './entities/doctor-location.entity';
import { Service } from './entities/service.entity';
import { ServiceByClinic } from './entities/service-by-clinic.entity';
import { ServiceSchedule } from './entities/service-schedule.entity';
import { Appointment } from './entities/appointment.entity';
import { DoctorWorkingHours } from './entities/doctor-working-hours.entity';
import { DoctorException } from './entities/doctor-exception.entity';
import { ServiceWorkingHours } from './entities/service-working-hours.entity';
import { ServiceException } from './entities/service-exception.entity';
import { ServiceAppointment } from './entities/service-appointment.entity';
import { Person } from './entities/person.entity';
import { ClinicPatient } from './entities/clinic-patient.entity';
import { TokenUsage } from './entities/token-usage.entity';

export const DB_ENTITIES = [
  ClinicNet,
  Clinic,
  MedField,
  Speciality,
  Doctor,
  DoctorLocation,
  Service,
  ServiceByClinic,
  ServiceSchedule,
  Appointment,
  DoctorWorkingHours,
  DoctorException,
  ServiceWorkingHours,
  ServiceException,
  ServiceAppointment,
  Person,
  ClinicPatient,
  TokenUsage,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'root'),
        password: config.get<string>('DB_PASSWORD', 'root'),
        database: config.get<string>('DB_NAME', 'med'),
        entities: DB_ENTITIES,
        synchronize: false,   // миграции управляются вручную через SQL
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
