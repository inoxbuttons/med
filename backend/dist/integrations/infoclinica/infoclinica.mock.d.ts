import { IcFilial, IcDepartment, IcDoctor, IcScheduleInterval, IcFreeSlot, IcBookingRequest, IcBookingResult, IcCancelResult, IcPatientRegisterRequest, IcPatientResult, IcService, IInfclinicaClient } from './infoclinica.types';
export declare class InfclinicaMockClient implements IInfclinicaClient {
    getFilialList(): Promise<IcFilial[]>;
    getDepartmentList(): Promise<IcDepartment[]>;
    getDoctorList(filialId?: number): Promise<IcDoctor[]>;
    getDoctorSchedule(filialId: number, fromDate: string, toDate: string): Promise<IcScheduleInterval[]>;
    getFreeSlots(doctorCode: number, fromDate: string, toDate: string, filialId?: number): Promise<IcFreeSlot[]>;
    bookAppointment(request: IcBookingRequest, _filialId: number): Promise<IcBookingResult>;
    cancelAppointment(schedId: number, _filialId: number): Promise<IcCancelResult>;
    registerPatient(patient: IcPatientRegisterRequest): Promise<IcPatientResult>;
    getServices(doctorCode: number, depNum: number, filialId: number): Promise<IcService[]>;
}
