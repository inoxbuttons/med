export interface MfPage<T> {
    count: number;
    num_pages: number;
    links: {
        next: string | null;
        previous: string | null;
    };
    data: T[];
}
export interface MfSpeciality {
    id: number;
    name: string;
}
export interface MfLpu {
    id: number;
    lpu_group_id: number | null;
    name: string;
    address: string;
    phone?: string;
    town_id: number;
    town_name?: string;
    district_id?: number;
    lon?: number;
    lat?: number;
    direct_appointment_is_supported: boolean;
    cancel_appointment_is_supported: boolean;
    is_visible: boolean;
    specialities: number[];
}
export interface MfDoctorPrice {
    lpu_id?: number;
    speciality_id: number;
    price: number | null;
}
export interface MfDoctor {
    id: number;
    efio: string;
    specialities: number[];
    lpus: number[];
    prices?: MfDoctorPrice[];
    rating?: {
        stars: number;
        public: number;
    };
}
export interface MfCell {
    dt_start: string;
    dt_end: string;
}
export interface MfDoctorSchedule {
    doctor_id: number;
    prices: {
        speciality_id: number;
        price: number | null;
    }[];
    allowed_age: {
        speciality_id: number;
        min: number;
        max: number;
    }[];
    cells: MfCell[];
}
export interface MfLpuSchedule {
    lpu_id: number;
    schedule: MfDoctorSchedule[];
}
export interface MfBookingRequest {
    doctor: {
        id: number;
        lpu_id: number;
        speciality_id: number;
    };
    appointment: {
        dt_start: string;
        dt_end: string;
        price: number;
        comment?: string;
    };
    client: {
        first_name: string;
        last_name: string;
        second_name: string;
        mobile_phone: string;
        birthday: string;
    };
}
export interface MfBookingResponse {
    claim_id: string;
}
export interface MfCancelRequest {
    uuid: string;
}
export interface MfAppointmentHistory {
    id: number;
    uuid: string;
    date: string;
    time_start: string;
    time_end: string;
    price: number;
    canceled: boolean;
    lpu: {
        id: number;
        name: string;
        address: string;
    };
    doctor: {
        id: number;
        fio: string;
        speciality_id: number;
        speciality_name: string;
    };
    patient: {
        mobile_phone: string;
        first_name: string;
        second_name: string;
        last_name: string;
        birthday: string;
    };
}
export interface MfServiceCategory {
    id: number;
    name: string;
}
export interface MfService {
    id: string;
    category_id: number;
    name: string;
    duration: number | null;
    price: number;
    doctor_ids: number[];
}
export interface MfServiceCategoriesResponse {
    count: number;
    num_pages: number;
    links: {
        next: string | null;
        previous: string | null;
    };
    data: {
        lpu_id: number;
        categories: MfServiceCategory[];
    };
}
export interface MfServicePricesResponse {
    count: number;
    num_pages: number;
    links: {
        next: string | null;
        previous: string | null;
    };
    data: {
        lpu_id: number;
        services: MfService[];
    };
}
export interface MfTown {
    id: number;
    name: string;
    region_id?: number;
}
export interface MfDistrict {
    id: number;
    name: string;
    town_id: number;
}
