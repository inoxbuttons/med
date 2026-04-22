/**
 * HTTP-клиент MedFlex API.
 * Авторизация: Token {apiKey}
 * v1: https://api.medflex.ru/v1/  — clinics, doctors, specialities, schedule/lpu/, direct_appointment/
 * v2: https://api.medflex.ru/v2/  — schedule/ (с town_id), towns, districts, metro
 */

import {
  MfPage,
  MfSpeciality,
  MfLpu,
  MfDoctor,
  MfLpuSchedule,
  MfBookingRequest,
  MfBookingResponse,
  MfAppointmentHistory,
} from './medflex.types';

/** Базовый URL API MedFlex. Эндпоинты без версионного префикса (/v1/, /v2/). */
const BASE_V1 = 'https://api.medflex.ru';
const BASE_V2 = 'https://api.medflex.ru';

export class MedflexClient {
  constructor(private readonly apiKey: string) {}

  // ── Внутренние helpers ────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      Authorization: `Token ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async get<T>(base: string, path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
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
    return res.json() as Promise<T>;
  }

  private async post<T>(base: string, path: string, body: unknown): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (res.status === 204) return {} as T;
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`MedFlex POST ${path} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  /** Загружает все страницы для коллекции, пока есть next. */
  private async getAllPages<T>(base: string, path: string, params: Record<string, string | number | boolean | undefined>): Promise<T[]> {
    const result: T[] = [];
    let page = 1;
    while (true) {
      const page_data = await this.get<MfPage<T>>(base, path, { ...params, size: 50, page });
      result.push(...page_data.data);
      if (!page_data.links.next || page >= page_data.num_pages) break;
      page++;
    }
    return result;
  }

  // ── Справочники ───────────────────────────────────────────────────────────

  /** Все специальности (v1). Обычно 100-300 записей. */
  async getSpecialities(): Promise<MfSpeciality[]> {
    return this.getAllPages<MfSpeciality>(BASE_V1, '/models/speciality/', {});
  }

  /**
   * Список клиник (lpu) для группы. (v1)
   * @param lpuGroupId — идентификатор сети (lpu_group_id = clinicNetId)
   * @param specialityIds — фильтр по специальностям (comma-separated)
   * @param townId — фильтр по городу (для будущей геофильтрации)
   */
  async getLpus(params: {
    lpuGroupId?: number;
    specialityIds?: string;
    townId?: number;
    size?: number;
    page?: number;
  }): Promise<MfPage<MfLpu>> {
    return this.get<MfPage<MfLpu>>(BASE_V1, '/models/lpu/', {
      lpu_group_id: params.lpuGroupId,
      speciality_ids: params.specialityIds,
      town_id: params.townId,
      size: params.size ?? 50,
      page: params.page ?? 1,
    });
  }

  /** Все клиники группы (все страницы). */
  async getAllLpus(lpuGroupId: number, townId?: number): Promise<MfLpu[]> {
    return this.getAllPages<MfLpu>(BASE_V1, '/models/lpu/', {
      lpu_group_id: lpuGroupId,
      town_id: townId,
    });
  }

  /**
   * Врачи с фильтрацией. (v1)
   * Возвращает только врачей, у которых есть слоты расписания.
   */
  async getDoctors(params: {
    lpuIds?: string;
    specialityIds?: string;
    doctorIds?: string;
    page?: number;
    size?: number;
  }): Promise<MfPage<MfDoctor>> {
    return this.get<MfPage<MfDoctor>>(BASE_V1, '/models/doctor/', {
      lpu_ids: params.lpuIds,
      speciality_ids: params.specialityIds,
      doctor_ids: params.doctorIds,
      page: params.page ?? 1,
      size: params.size ?? 50,
    });
  }

  // ── Расписание ────────────────────────────────────────────────────────────

  /**
   * Расписание по списку клиник. (v1/schedule/lpu/)
   * Возвращает только свободные слоты.
   * @param lpuIds — comma-separated lpu IDs (обязательно)
   * @param dateStart — начало периода YYYY-MM-DD
   * @param days — количество дней (1–30, default 14)
   */
  async getScheduleByLpu(params: {
    lpuIds: string;
    dateStart?: string;
    days?: number;
    page?: number;
  }): Promise<MfPage<MfLpuSchedule>> {
    return this.get<MfPage<MfLpuSchedule>>(BASE_V1, '/schedule/lpu/', {
      lpu_ids: params.lpuIds,
      date_start: params.dateStart,
      days: params.days ?? 14,
      page: params.page ?? 1,
    });
  }

  /**
   * Расписание с геофильтрацией. (v2/schedule/)
   * Требует town_id. Используется для поиска по городу / району / метро.
   * Зарезервировано для будущей геофильтрации.
   */
  async getScheduleByGeo(params: {
    townId: number;
    lpuIds?: string;
    specialityIds?: string;
    districtId?: number;
    metroId?: number;
    dateStart?: string;
    days?: number;
    page?: number;
  }): Promise<MfPage<MfLpuSchedule>> {
    return this.get<MfPage<MfLpuSchedule>>(BASE_V2, '/schedule/', {
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

  // ── Запись ────────────────────────────────────────────────────────────────

  async createAppointment(request: MfBookingRequest): Promise<MfBookingResponse> {
    return this.post<MfBookingResponse>(BASE_V1, '/direct_appointment/doctor/execute/', request);
  }

  async cancelAppointment(uuid: string): Promise<void> {
    await this.post<void>(BASE_V1, '/direct_appointment/doctor/cancel/', { uuid });
  }

  async getAppointmentHistory(params: {
    mobilePhone?: string;
    lpuId?: number;
    dateStart?: string;
    dateEnd?: string;
    uuid?: string;
    page?: number;
    size?: number;
  }): Promise<MfPage<MfAppointmentHistory>> {
    return this.get<MfPage<MfAppointmentHistory>>(BASE_V1, '/direct_appointment/history/', {
      mobile_phone: params.mobilePhone,
      lpu_id: params.lpuId,
      date_start: params.dateStart,
      date_end: params.dateEnd,
      uuid: params.uuid,
      page: params.page ?? 1,
      size: params.size ?? 50,
    });
  }
}
