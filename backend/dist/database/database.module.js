"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = exports.DB_ENTITIES = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const clinic_net_entity_1 = require("./entities/clinic-net.entity");
const clinic_entity_1 = require("./entities/clinic.entity");
const med_field_entity_1 = require("./entities/med-field.entity");
const speciality_entity_1 = require("./entities/speciality.entity");
const doctor_entity_1 = require("./entities/doctor.entity");
const doctor_location_entity_1 = require("./entities/doctor-location.entity");
const service_entity_1 = require("./entities/service.entity");
const service_by_clinic_entity_1 = require("./entities/service-by-clinic.entity");
const service_schedule_entity_1 = require("./entities/service-schedule.entity");
const appointment_entity_1 = require("./entities/appointment.entity");
const doctor_working_hours_entity_1 = require("./entities/doctor-working-hours.entity");
const doctor_exception_entity_1 = require("./entities/doctor-exception.entity");
const service_working_hours_entity_1 = require("./entities/service-working-hours.entity");
const service_exception_entity_1 = require("./entities/service-exception.entity");
const service_appointment_entity_1 = require("./entities/service-appointment.entity");
const person_entity_1 = require("./entities/person.entity");
const clinic_patient_entity_1 = require("./entities/clinic-patient.entity");
const token_usage_entity_1 = require("./entities/token-usage.entity");
exports.DB_ENTITIES = [
    clinic_net_entity_1.ClinicNet,
    clinic_entity_1.Clinic,
    med_field_entity_1.MedField,
    speciality_entity_1.Speciality,
    doctor_entity_1.Doctor,
    doctor_location_entity_1.DoctorLocation,
    service_entity_1.Service,
    service_by_clinic_entity_1.ServiceByClinic,
    service_schedule_entity_1.ServiceSchedule,
    appointment_entity_1.Appointment,
    doctor_working_hours_entity_1.DoctorWorkingHours,
    doctor_exception_entity_1.DoctorException,
    service_working_hours_entity_1.ServiceWorkingHours,
    service_exception_entity_1.ServiceException,
    service_appointment_entity_1.ServiceAppointment,
    person_entity_1.Person,
    clinic_patient_entity_1.ClinicPatient,
    token_usage_entity_1.TokenUsage,
];
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    type: 'postgres',
                    host: config.get('DB_HOST', 'localhost'),
                    port: config.get('DB_PORT', 5432),
                    username: config.get('DB_USER', 'root'),
                    password: config.get('DB_PASSWORD', 'root'),
                    database: config.get('DB_NAME', 'med'),
                    entities: exports.DB_ENTITIES,
                    synchronize: false,
                    logging: config.get('NODE_ENV') !== 'production',
                }),
            }),
        ],
        exports: [typeorm_1.TypeOrmModule],
    })
], DatabaseModule);
//# sourceMappingURL=database.module.js.map