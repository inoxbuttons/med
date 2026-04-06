import { ClinicNet } from './entities/clinic-net.entity';
import { Clinic } from './entities/clinic.entity';
import { MedField } from './entities/med-field.entity';
import { Speciality } from './entities/speciality.entity';
import { Doctor } from './entities/doctor.entity';
import { DoctorLocation } from './entities/doctor-location.entity';
import { Service } from './entities/service.entity';
import { ServiceByClinic } from './entities/service-by-clinic.entity';
import { ServiceSchedule } from './entities/service-schedule.entity';
import { DoctorWorkingHours } from './entities/doctor-working-hours.entity';
import { DoctorException } from './entities/doctor-exception.entity';
import { ServiceWorkingHours } from './entities/service-working-hours.entity';
import { ServiceException } from './entities/service-exception.entity';
import { ServiceAppointment } from './entities/service-appointment.entity';
import { Person } from './entities/person.entity';
import { ClinicPatient } from './entities/clinic-patient.entity';
export declare const DB_ENTITIES: (typeof ClinicNet | typeof Clinic | typeof ServiceByClinic | typeof Service | typeof MedField | typeof Speciality | typeof Doctor | typeof DoctorLocation | typeof ServiceSchedule | typeof DoctorWorkingHours | typeof DoctorException | typeof ServiceWorkingHours | typeof ServiceException | typeof ServiceAppointment | typeof Person | typeof ClinicPatient)[];
export declare class DatabaseModule {
}
