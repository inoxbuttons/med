import { Doctor } from './doctor.entity';
export declare enum DoctorExceptionType {
    DAY_OFF = "day_off",
    SICK_LEAVE = "sick_leave",
    VACATION = "vacation",
    TRAINING = "training",
    OTHER = "other"
}
export declare class DoctorException {
    id: number;
    doctorId: number;
    date: string;
    startTime: string | null;
    endTime: string | null;
    type: DoctorExceptionType;
    comment: string | null;
    doctor: Doctor;
    createdAt: Date;
    updatedAt: Date;
}
