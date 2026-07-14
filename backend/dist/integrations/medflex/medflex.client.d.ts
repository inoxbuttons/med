import { MfPage, MfSpeciality, MfLpu, MfDoctor, MfLpuSchedule, MfBookingRequest, MfBookingResponse, MfAppointmentHistory, MfServiceCategory, MfService } from './medflex.types';
export declare class MedflexClient {
    private readonly apiKey;
    private readonly baseV1;
    private readonly baseV2;
    constructor(apiKey: string, baseUrl?: string);
    private headers;
    private get;
    private post;
    private getAllPages;
    getSpecialities(): Promise<MfSpeciality[]>;
    getLpus(params: {
        lpuGroupId?: number;
        specialityIds?: string;
        townId?: number;
        size?: number;
        page?: number;
    }): Promise<MfPage<MfLpu>>;
    getAllLpus(lpuGroupId: number, townId?: number): Promise<MfLpu[]>;
    getDoctors(params: {
        lpuIds?: string;
        specialityIds?: string;
        doctorIds?: string;
        page?: number;
        size?: number;
    }): Promise<MfPage<MfDoctor>>;
    getScheduleByLpu(params: {
        lpuIds: string;
        dateStart?: string;
        days?: number;
        page?: number;
    }): Promise<MfPage<MfLpuSchedule>>;
    getScheduleByGeo(params: {
        townId: number;
        lpuIds?: string;
        specialityIds?: string;
        districtId?: number;
        metroId?: number;
        dateStart?: string;
        days?: number;
        page?: number;
    }): Promise<MfPage<MfLpuSchedule>>;
    getServiceCategories(lpuId: number): Promise<MfServiceCategory[]>;
    getServicePrices(params: {
        lpuId: number;
        doctorId?: number;
        categoryIds?: string;
        size?: number;
        page?: number;
    }): Promise<MfService[]>;
    createAppointment(request: MfBookingRequest): Promise<MfBookingResponse>;
    cancelAppointment(uuid: string): Promise<void>;
    getAppointmentHistory(params: {
        mobilePhone?: string;
        lpuId?: number;
        doctorId?: number;
        dateStart?: string;
        dateEnd?: string;
        uuid?: string;
        includeCanceled?: boolean;
        page?: number;
        size?: number;
    }): Promise<MfPage<MfAppointmentHistory>>;
}
