"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedflexClient = void 0;
class MedflexClient {
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        const base = baseUrl ?? process.env.MEDFLEX_BASE_URL ?? 'https://api.medflex.ru';
        this.baseV1 = base;
        this.baseV2 = base;
    }
    headers() {
        return {
            Authorization: `Token ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }
    async get(base, path, params) {
        const url = new URL(`${base}${path}`);
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null && v !== '') {
                url.searchParams.set(k, String(v));
            }
        }
        const res = await fetch(url.toString(), { headers: this.headers() });
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            throw new Error(`MedFlex GET ${path} → ${res.status}: ${text}`);
        }
        return res.json();
    }
    async post(base, path, body) {
        const res = await fetch(`${base}${path}`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body),
        });
        if (res.status === 204)
            return {};
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            throw new Error(`MedFlex POST ${path} → ${res.status}: ${text}`);
        }
        return res.json();
    }
    async getAllPages(base, path, params) {
        const result = [];
        let page = 1;
        while (true) {
            const page_data = await this.get(base, path, { ...params, size: 50, page });
            result.push(...page_data.data);
            if (!page_data.links.next || page >= page_data.num_pages)
                break;
            page++;
        }
        return result;
    }
    async getSpecialities() {
        return this.getAllPages(this.baseV1, '/models/speciality/', {});
    }
    async getLpus(params) {
        return this.get(this.baseV1, '/models/lpu/', {
            lpu_group_id: params.lpuGroupId,
            speciality_ids: params.specialityIds,
            town_id: params.townId,
            size: params.size ?? 50,
            page: params.page ?? 1,
        });
    }
    async getAllLpus(lpuGroupId, townId) {
        return this.getAllPages(this.baseV1, '/models/lpu/', {
            lpu_group_id: lpuGroupId,
            town_id: townId,
        });
    }
    async getDoctors(params) {
        return this.get(this.baseV1, '/models/doctor/', {
            lpu_ids: params.lpuIds,
            speciality_ids: params.specialityIds,
            doctor_ids: params.doctorIds,
            page: params.page ?? 1,
            size: params.size ?? 50,
        });
    }
    async getScheduleByLpu(params) {
        return this.get(this.baseV1, '/schedule/lpu/', {
            lpu_ids: params.lpuIds,
            date_start: params.dateStart,
            days: params.days ?? 14,
            page: params.page ?? 1,
        });
    }
    async getScheduleByGeo(params) {
        return this.get(this.baseV2, '/schedule/', {
            town_id: params.townId,
            lpu_ids: params.lpuIds,
            speciality_ids: params.specialityIds,
            district_id: params.districtId,
            metro_id: params.metroId,
            date_start: params.dateStart,
            days: params.days ?? 14,
            page: params.page ?? 1,
        });
    }
    async getServiceCategories(lpuId) {
        const resp = await this.get(this.baseV1, '/services/categories/', {
            lpu_id: lpuId,
            size: 200,
        });
        return resp.data.categories;
    }
    async getServicePrices(params) {
        const resp = await this.get(this.baseV1, '/services/prices/', {
            lpu_id: params.lpuId,
            doctor_id: params.doctorId,
            category_ids: params.categoryIds,
            size: params.size ?? 500,
            page: params.page ?? 1,
        });
        return resp.data.services;
    }
    async createAppointment(request) {
        return this.post(this.baseV1, '/direct_appointment/doctor/execute/', request);
    }
    async cancelAppointment(uuid) {
        await this.post(this.baseV1, '/direct_appointment/doctor/cancel/', { uuid });
    }
    async getAppointmentHistory(params) {
        return this.get(this.baseV1, '/direct_appointment/history/', {
            mobile_phone: params.mobilePhone,
            lpu_id: params.lpuId,
            doctor_id: params.doctorId,
            date_start: params.dateStart,
            date_end: params.dateEnd,
            uuid: params.uuid,
            include_canceled: params.includeCanceled,
            page: params.page ?? 1,
            size: params.size ?? 200,
        });
    }
}
exports.MedflexClient = MedflexClient;
//# sourceMappingURL=medflex.client.js.map