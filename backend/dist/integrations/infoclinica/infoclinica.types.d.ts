export interface InfclinicaConfig {
    apiUrl: string;
    host: string;
    certPath?: string;
    certPassword?: string;
    useMock: boolean;
}
export interface IcFilial {
    FILIAL: number;
    FNAME: string;
    FADDRESS?: string;
    FPHONE?: string;
    CASHID?: number;
}
export interface IcDepartment {
    DEPNUM: number;
    DEPNAME: string;
}
export interface IcDoctor {
    DCODE: number;
    DNAME: string;
    DEPNUM: number;
    DEPNAME: string;
    FILIAL: number;
    FNAME: string;
    EXTPCODE?: string;
    PRICE?: number;
}
export interface IcScheduleInterval {
    SCHEDIDENT: number;
    DCODE: number;
    DNAME: string;
    DEPNUM: number;
    DEPNAME: string;
    FILIAL: number;
    FNAME: string;
    WDATE: string;
    BEGHOUR: number;
    BEGMIN: number;
    ENDHOUR: number;
    ENDMIN: number;
    ONLINEMODE: number;
}
export interface IcFreeSlot {
    SHEDIDENT: number;
    DCODE: number;
    WDATE: string;
    BHOUR: number;
    BMIN: number;
    FHOUR: number;
    FMIN: number;
    FREETYPE: number;
    FILIAL: number;
    DEPNUM: number;
}
export interface IcBookingRequest {
    DCODE: number;
    WORKDATE: string;
    BHOUR: number;
    BMIN: number;
    FHOUR: number;
    FMIN: number;
    SHEDIDENT: number;
    DEPNUM: number;
    PCODE: number;
    ANOTE?: string;
    ONLINETYPE: number;
    CALLERID?: string;
    SCHEDID?: number;
}
export interface IcBookingResult {
    SPRESULT: number;
    SPCOMMENT: string;
    SCHEDID?: number;
    CHECKTEXT?: string;
}
export interface IcCancelResult {
    SPRESULT: number;
    SPCOMMENT: string;
}
export interface IcPatientRegisterRequest {
    LASTNAME: string;
    FIRSTNAME: string;
    MIDNAME?: string;
    PHONE: string;
    BDATE: string;
    GENDER: 1 | 2;
}
export interface IcPatientResult {
    SPRESULT: number;
    SPCOMMENT: string;
    PCODE?: number;
}
export interface IcAppointmentChange {
    CHANGEID: number;
    CHANGEOP: 0 | 1 | 2;
    SCHEDID: number;
    WORKDATE: string;
    BHOUR: number;
    BMIN: number;
    FHOUR: number;
    FMIN: number;
    FILIAL: number;
    FNAME: string;
    DCODE: number;
    DNAME: string;
    PCODE: number;
    ANOTE?: string;
    ISPRIMARY: number;
    CALLTYPE: number;
    CLVISIT: number;
    TREATCODE: number;
    CALLERID?: string;
}
export interface IcService {
    SCHID: number;
    KODOPER: string;
    SCHNAME: string;
    SPRICE?: number;
    DISCPRICE?: number;
    FILIAL: number;
    FNAME: string;
    SPECCODE: number;
    SPECNAME: string;
    COMMENT?: string;
    SCHSCHEDTYPE: number;
}
export interface IInfclinicaClient {
    getFilialList(): Promise<IcFilial[]>;
    getDepartmentList(): Promise<IcDepartment[]>;
    getDoctorList(filialId?: number, firstRow?: number, lastRow?: number): Promise<IcDoctor[]>;
    getDoctorSchedule(filialId: number, fromDate: string, toDate: string): Promise<IcScheduleInterval[]>;
    getFreeSlots(doctorCode: number, fromDate: string, toDate: string, filialId?: number): Promise<IcFreeSlot[]>;
    bookAppointment(request: IcBookingRequest, filialId: number): Promise<IcBookingResult>;
    cancelAppointment(schedId: number, filialId: number): Promise<IcCancelResult>;
    registerPatient(patient: IcPatientRegisterRequest): Promise<IcPatientResult>;
    getServices(doctorCode: number, depNum: number, filialId: number): Promise<IcService[]>;
}
