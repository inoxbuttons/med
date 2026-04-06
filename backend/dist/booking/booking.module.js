"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const booking_service_1 = require("./booking.service");
const clinic_entity_1 = require("../database/entities/clinic.entity");
const doctor_entity_1 = require("../database/entities/doctor.entity");
const doctor_location_entity_1 = require("../database/entities/doctor-location.entity");
const doctor_working_hours_entity_1 = require("../database/entities/doctor-working-hours.entity");
const doctor_exception_entity_1 = require("../database/entities/doctor-exception.entity");
const service_working_hours_entity_1 = require("../database/entities/service-working-hours.entity");
const service_exception_entity_1 = require("../database/entities/service-exception.entity");
const service_appointment_entity_1 = require("../database/entities/service-appointment.entity");
const service_entity_1 = require("../database/entities/service.entity");
const service_by_clinic_entity_1 = require("../database/entities/service-by-clinic.entity");
const service_schedule_entity_1 = require("../database/entities/service-schedule.entity");
const appointment_entity_1 = require("../database/entities/appointment.entity");
let BookingModule = class BookingModule {
};
exports.BookingModule = BookingModule;
exports.BookingModule = BookingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                clinic_entity_1.Clinic,
                doctor_entity_1.Doctor,
                doctor_location_entity_1.DoctorLocation,
                doctor_working_hours_entity_1.DoctorWorkingHours,
                doctor_exception_entity_1.DoctorException,
                service_entity_1.Service,
                service_by_clinic_entity_1.ServiceByClinic,
                service_schedule_entity_1.ServiceSchedule,
                appointment_entity_1.Appointment,
                service_working_hours_entity_1.ServiceWorkingHours,
                service_exception_entity_1.ServiceException,
                service_appointment_entity_1.ServiceAppointment,
            ]),
        ],
        providers: [booking_service_1.BookingService],
        exports: [booking_service_1.BookingService],
    })
], BookingModule);
//# sourceMappingURL=booking.module.js.map