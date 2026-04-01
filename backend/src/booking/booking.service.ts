import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, ILike, Repository } from 'typeorm';
import { Clinic } from '../database/entities/clinic.entity';
import { Doctor } from '../database/entities/doctor.entity';
import { DoctorLocation } from '../database/entities/doctor-location.entity';
import { DoctorWorkingHours } from '../database/entities/doctor-working-hours.entity';
import { DoctorException } from '../database/entities/doctor-exception.entity';
import { Service } from '../database/entities/service.entity';
import { ServiceByClinic } from '../database/entities/service-by-clinic.entity';
import { ServiceSchedule } from '../database/entities/service-schedule.entity';
import { Appointment } from '../database/entities/appointment.entity';
import { ServiceWorkingHours } from '../database/entities/service-working-hours.entity';
import { ServiceException } from '../database/entities/service-exception.entity';
import { ServiceAppointment } from '../database/entities/service-appointment.entity';
import {
  SERVICE_APPOINTMENT_MINUTES,
  MAX_SLOTS_IN_RESPONSE,
  DEFAULT_SEARCH_DAYS,
} from './booking.constants';
import { LlmTool } from '../llm/llm.types';

export type SlotMode = 'nearest' | 'day' | 'week';

export interface ClinicInfo {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
}

export interface DoctorInfo {
  id: number;
  name: string;
  speciality: string;
  price: number | null;
  clinics: { id: number; name: string }[];
}

export interface ServiceInfo {
  id: number;
  name: string;
  direction: string | null;
  clinics: { id: number; name: string; price: number | null }[];
}

export interface SlotGroup {
  date: string;
  dayName: string;
  clinicId: number;
  clinicName: string;
  times: string[];
  /** Заполняется только когда times пуст в режиме day — объясняет причину */
  note?: string;
}

export interface BookingResult {
  success: boolean;
  appointmentId?: number;
  message: string;
}

export interface PatientAppointmentItem {
  type: 'doctor' | 'service';
  date: string;
  time: string;
  clinicName: string;
  doctorName?: string;
  speciality?: string;
  serviceName?: string;
}

export interface CancellableAppointment extends PatientAppointmentItem {
  id: number;
  doctorId?: number;
  serviceId?: number;
  clinicId: number;
}

const DAY_NAMES = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(DoctorLocation)
    private readonly doctorLocationRepo: Repository<DoctorLocation>,
    @InjectRepository(DoctorWorkingHours)
    private readonly workingHoursRepo: Repository<DoctorWorkingHours>,
    @InjectRepository(DoctorException)
    private readonly exceptionRepo: Repository<DoctorException>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(ServiceByClinic)
    private readonly serviceByClinicRepo: Repository<ServiceByClinic>,
    @InjectRepository(ServiceSchedule)
    private readonly serviceScheduleRepo: Repository<ServiceSchedule>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(ServiceWorkingHours)
    private readonly serviceWorkingHoursRepo: Repository<ServiceWorkingHours>,
    @InjectRepository(ServiceException)
    private readonly serviceExceptionRepo: Repository<ServiceException>,
    @InjectRepository(ServiceAppointment)
    private readonly serviceAppointmentRepo: Repository<ServiceAppointment>,
  ) {}

  // ── Clinics ────────────────────────────────────────────────────────────────

  async getClinics(): Promise<ClinicInfo[]> {
    const clinics = await this.clinicRepo.find({ order: { name: 'ASC' } });
    return clinics.map((c) => ({
      id: c.id,
      name: c.name,
      address: c.address,
      phone: c.phone,
    }));
  }

  // ── Doctors ────────────────────────────────────────────────────────────────

  async findDoctors(speciality: string, clinicId?: number): Promise<DoctorInfo[]> {
    const qb = this.doctorRepo
      .createQueryBuilder('d')
      .innerJoinAndSelect('d.speciality', 's')
      .innerJoin('doctor_locations', 'dl', 'dl.doctor_id = d.id')
      .where('(s.name ILIKE :q OR d.name ILIKE :q)', { q: `%${speciality}%` });

    if (clinicId) {
      qb.andWhere('dl.clinic_id = :clinicId', { clinicId });
    }

    const doctors = await qb.getMany();
    if (doctors.length === 0) return [];

    const doctorIds = doctors.map((d) => d.id);
    const locations = await this.doctorLocationRepo
      .createQueryBuilder('dl')
      .innerJoinAndSelect('dl.clinic', 'c')
      .where('dl.doctor_id IN (:...ids)', { ids: doctorIds })
      .getMany();

    const locationsByDoctor = new Map<number, DoctorLocation[]>();
    for (const loc of locations) {
      const arr = locationsByDoctor.get(loc.doctorId) ?? [];
      arr.push(loc);
      locationsByDoctor.set(loc.doctorId, arr);
    }

    return doctors.map((d) => {
      const locs = locationsByDoctor.get(d.id) ?? [];
      const price = locs.length > 0 ? Number(locs[0].price) || null : null;
      return {
        id: d.id,
        name: d.name,
        speciality: d.speciality.name,
        price,
        clinics: locs.map((l) => ({ id: l.clinicId, name: l.clinic.name })),
      };
    });
  }

  // ── Services ───────────────────────────────────────────────────────────────

  async findServices(query: string, clinicId?: number): Promise<ServiceInfo[]> {
    const qb = this.serviceRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.medField', 'mf')
      .innerJoin('services_by_clinics', 'sbc', 'sbc.service_id = s.id')
      .where('s.name ILIKE :q', { q: `%${query}%` });

    if (clinicId) {
      qb.andWhere('sbc.clinic_id = :clinicId', { clinicId });
    }
    qb.limit(30);

    const services = await qb.getMany();
    if (services.length === 0) return [];

    const serviceIds = services.map((s) => s.id);
    const sbcs = await this.serviceByClinicRepo
      .createQueryBuilder('sbc')
      .innerJoinAndSelect('sbc.clinic', 'c')
      .where('sbc.service_id IN (:...ids)', { ids: serviceIds })
      .getMany();

    const sbcByService = new Map<number, ServiceByClinic[]>();
    for (const sbc of sbcs) {
      const arr = sbcByService.get(sbc.serviceId) ?? [];
      arr.push(sbc);
      sbcByService.set(sbc.serviceId, arr);
    }

    return services.map((s) => ({
      id: s.id,
      name: s.name,
      direction: s.medField?.name ?? null,
      clinics: (sbcByService.get(s.id) ?? []).map((sbc) => ({
        id: sbc.clinicId,
        name: sbc.clinic.name,
        price: Number(sbc.price) || null,
      })),
    }));
  }

  // ── Slots ──────────────────────────────────────────────────────────────────

  async getAvailableSlots(params: {
    doctorId?: number;
    serviceId?: number;
    clinicId?: number;
    mode?: SlotMode;
    targetDate?: string;
  }): Promise<SlotGroup[]> {
    const { doctorId, serviceId, clinicId } = params;
    const mode: SlotMode = params.mode ?? 'nearest';

    if (doctorId) {
      return this.getDoctorSlots(doctorId, clinicId, mode, params.targetDate);
    }
    return this.getServiceSlots(serviceId!, clinicId, mode, params.targetDate);
  }

  private async getDoctorSlots(
    doctorId: number,
    clinicId: number | undefined,
    mode: SlotMode,
    targetDate?: string,
  ): Promise<SlotGroup[]> {
    // Рабочее расписание врача
    const whQb = this.workingHoursRepo
      .createQueryBuilder('wh')
      .innerJoinAndSelect('wh.clinic', 'c')
      .where('wh.doctor_id = :doctorId', { doctorId })
      .andWhere('wh.is_active = true');
    if (clinicId) whQb.andWhere('wh.clinic_id = :clinicId', { clinicId });
    const workingHours = await whQb.getMany();
    if (workingHours.length === 0) return [];

    const { from, days } = buildDateRange(mode, targetDate);
    const to = new Date(from);
    to.setDate(to.getDate() + days);
    const fromStr = toDateStr(from);
    const toStr = toDateStr(to);

    // Исключения (отсутствия)
    const exceptions = await this.exceptionRepo
      .createQueryBuilder('de')
      .where('de.doctor_id = :doctorId', { doctorId })
      .andWhere('de.date >= :from AND de.date < :to', { from: fromStr, to: toStr })
      .getMany();

    const exByDate = new Map<string, DoctorException[]>();
    for (const ex of exceptions) {
      const arr = exByDate.get(ex.date) ?? [];
      arr.push(ex);
      exByDate.set(ex.date, arr);
    }

    // Занятые записи
    const booked = await this.appointmentRepo.find({
      where: {
        doctorId,
        startTime: Between(from, to),
        ...(clinicId ? { clinicId } : {}),
      },
    });
    const bookedSet = new Set(booked.map((a) => a.startTime.toISOString()));

    const now = new Date();
    const result: SlotGroup[] = [];

    for (let d = 0; d < days; d++) {
      const date = new Date(from);
      date.setDate(date.getDate() + d);
      date.setHours(0, 0, 0, 0);

      const jsDay = date.getDay();
      const dbDay = jsDay === 0 ? 7 : jsDay;
      const dateStr = toDateStr(date);

      const daySchedules = workingHours.filter((wh) => wh.dayOfWeek === dbDay);
      if (daySchedules.length === 0) continue;

      const dayExceptions = exByDate.get(dateStr) ?? [];
      const fullDayAbsent = dayExceptions.some((ex) => ex.startTime === null);
      if (fullDayAbsent) continue;

      const partial = dayExceptions
        .filter((ex) => ex.startTime !== null)
        .map((ex) => ({ start: ex.startTime!.slice(0, 5), end: ex.endTime!.slice(0, 5) }));

      for (const sched of daySchedules) {
        const slots = generateSlots(
          date,
          sched.startTime,
          sched.endTime,
          sched.slotDuration,
          sched.breakStart,
          sched.breakEnd,
        );

        const times: string[] = [];
        for (const slot of slots) {
          if (slot <= now) continue;
          if (bookedSet.has(slot.toISOString())) continue;
          const t = toTimeStr(slot);
          if (partial.some((p) => t >= p.start && t < p.end)) continue;
          times.push(t);
        }

        // В режиме day возвращаем клинику даже если свободных слотов нет —
        // чтобы LLM мог ответить на вопрос "где принимает в этот день"
        if (times.length === 0 && mode !== 'day') continue;

        result.push({
          date: dateStr,
          dayName: DAY_NAMES[dbDay],
          clinicId: sched.clinicId,
          clinicName: (sched as any).clinic.name,
          times: mode === 'nearest' ? times.slice(0, 5) : times,
          ...(times.length === 0 ? { note: `Врач принимает в клинике ${(sched as any).clinic.name} в этот день (${sched.startTime.slice(0,5)}–${sched.endTime.slice(0,5)}), но свободных слотов уже нет` } : {}),
        });
      }

      // Для режима «ближайшее» возвращаем первый день с окнами
      if (mode === 'nearest' && result.length > 0) break;
    }

    return result;
  }

  private async getServiceSlots(
    serviceId: number,
    clinicId: number | undefined,
    mode: SlotMode,
    targetDate?: string,
  ): Promise<SlotGroup[]> {
    const whQb = this.serviceWorkingHoursRepo
      .createQueryBuilder('wh')
      .innerJoinAndSelect('wh.clinic', 'c')
      .where('wh.service_id = :serviceId', { serviceId })
      .andWhere('wh.is_active = true');
    if (clinicId) whQb.andWhere('wh.clinic_id = :clinicId', { clinicId });
    const workingHours = await whQb.getMany();
    if (workingHours.length === 0) return [];

    const { from, days } = buildDateRange(mode, targetDate);
    const to = new Date(from);
    to.setDate(to.getDate() + days);
    const fromStr = toDateStr(from);
    const toStr = toDateStr(to);

    const exceptions = await this.serviceExceptionRepo
      .createQueryBuilder('se')
      .where('se.service_id = :serviceId', { serviceId })
      .andWhere('se.date >= :from AND se.date < :to', { from: fromStr, to: toStr })
      .getMany();

    const exByDate = new Map<string, ServiceException[]>();
    for (const ex of exceptions) {
      const arr = exByDate.get(ex.date) ?? [];
      arr.push(ex);
      exByDate.set(ex.date, arr);
    }

    const booked = await this.serviceAppointmentRepo.find({
      where: {
        serviceId,
        startTime: Between(from, to),
        ...(clinicId ? { clinicId } : {}),
      },
    });
    const bookedSet = new Set(booked.map((a) => a.startTime.toISOString()));

    const now = new Date();
    const result: SlotGroup[] = [];

    for (let d = 0; d < days; d++) {
      const date = new Date(from);
      date.setDate(date.getDate() + d);
      date.setHours(0, 0, 0, 0);

      const jsDay = date.getDay();
      const dbDay = jsDay === 0 ? 7 : jsDay;
      const dateStr = toDateStr(date);

      const daySchedules = workingHours.filter((wh) => wh.dayOfWeek === dbDay);
      if (daySchedules.length === 0) continue;

      const dayExceptions = exByDate.get(dateStr) ?? [];
      const fullDayAbsent = dayExceptions.some((ex) => ex.startTime === null);
      if (fullDayAbsent) continue;

      const partial = dayExceptions
        .filter((ex) => ex.startTime !== null)
        .map((ex) => ({ start: ex.startTime!.slice(0, 5), end: ex.endTime!.slice(0, 5) }));

      for (const sched of daySchedules) {
        const slots = generateSlots(
          date,
          sched.startTime,
          sched.endTime,
          sched.slotDuration,
          sched.breakStart,
          sched.breakEnd,
        );

        const times: string[] = [];
        for (const slot of slots) {
          if (slot <= now) continue;
          if (bookedSet.has(slot.toISOString())) continue;
          const t = toTimeStr(slot);
          if (partial.some((p) => t >= p.start && t < p.end)) continue;
          times.push(t);
        }

        if (times.length === 0 && mode !== 'day') continue;

        result.push({
          date: dateStr,
          dayName: DAY_NAMES[dbDay],
          clinicId: sched.clinicId,
          clinicName: (sched as any).clinic.name,
          times: mode === 'nearest' ? times.slice(0, 5) : times,
          ...(times.length === 0 ? { note: `Услуга доступна в клинике ${(sched as any).clinic.name} в этот день (${sched.startTime.slice(0,5)}–${sched.endTime.slice(0,5)}), но свободных слотов уже нет` } : {}),
        });
      }

      if (mode === 'nearest' && result.length > 0) break;
    }

    return result;
  }

  // ── Booking ────────────────────────────────────────────────────────────────

  async bookAppointment(params: {
    doctorId?: number;
    serviceId?: number;
    clinicId: number;
    startTime: string;
    patientId?: number;
    source?: string;
    comment?: string;
  }): Promise<BookingResult> {
    const { doctorId, serviceId, clinicId, patientId, source, comment } = params;
    const start = new Date(params.startTime);

    if (start <= new Date()) {
      return { success: false, message: 'Нельзя записаться на прошедшее время. Пожалуйста, выберите будущий слот.' };
    }

    // Проверяем существование врача/клиники, чтобы поймать галлюцинации LLM
    let doctorName: string | undefined;
    if (doctorId) {
      const doctorExists = await this.doctorRepo.findOne({ where: { id: doctorId } });
      if (!doctorExists) {
        return { success: false, message: `Врач с id=${doctorId} не найден. Используй find_doctors для получения корректного ID врача.` };
      }
      doctorName = doctorExists.name;
    }
    const clinicExists = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinicExists) {
      return { success: false, message: `Клиника с id=${clinicId} не найдена. Используй get_clinics для получения корректного ID клиники.` };
    }
    const clinicName = clinicExists.name;

    if (serviceId) {
      return this.bookServiceAppointment({ serviceId, clinicId, clinicName, start, patientId, source, comment });
    }

    // ── Doctor appointment ──────────────────────────────────────────────────
    const wh = await this.workingHoursRepo.findOne({
      where: { doctorId, clinicId, isActive: true },
    });
    const duration = wh?.slotDuration ?? SERVICE_APPOINTMENT_MINUTES;
    const end = new Date(start.getTime() + duration * 60_000);

    const conflict = await this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.clinic_id = :clinicId', { clinicId })
      .andWhere('a.doctor_id = :doctorId', { doctorId })
      .andWhere('a.start_time < :end AND a.end_time > :start', { start, end })
      .getOne();

    if (conflict) {
      return { success: false, message: 'Это время уже занято. Пожалуйста, выберите другой слот.' };
    }

    const appt = this.appointmentRepo.create({
      doctorId: doctorId ?? null,
      serviceId: null,
      clinicId,
      startTime: start,
      endTime: end,
      patientId: patientId ?? null,
      source: (source as any) ?? 'ai',
      comment: comment ?? null,
    });

    const saved = await this.appointmentRepo.save(appt);
    this.logger.log(`Booked doctor appointment #${saved.id} at ${start.toISOString()}`);

    return {
      success: true,
      appointmentId: saved.id,
      message:
        `Запись подтверждена! ${doctorName}, ${formatRuDateTime(start)}, ${clinicName}.`,
    };
  }

  private async bookServiceAppointment(params: {
    serviceId: number;
    clinicId: number;
    clinicName: string;
    start: Date;
    patientId?: number | null;
    source?: string;
    comment?: string | null;
  }): Promise<BookingResult> {
    const { serviceId, clinicId, clinicName, start, patientId, source, comment } = params;

    const serviceExists = await this.serviceRepo.findOne({ where: { id: serviceId } });
    if (!serviceExists) {
      return { success: false, message: `Услуга с id=${serviceId} не найдена. Используй find_services для получения корректного ID.` };
    }

    const wh = await this.serviceWorkingHoursRepo.findOne({
      where: { serviceId, clinicId, isActive: true },
    });
    const duration = wh?.slotDuration ?? SERVICE_APPOINTMENT_MINUTES;
    const end = new Date(start.getTime() + duration * 60_000);

    const conflict = await this.serviceAppointmentRepo
      .createQueryBuilder('a')
      .where('a.clinic_id = :clinicId', { clinicId })
      .andWhere('a.service_id = :serviceId', { serviceId })
      .andWhere('a.start_time < :end AND a.end_time > :start', { start, end })
      .getOne();

    if (conflict) {
      return { success: false, message: 'Это время уже занято. Пожалуйста, выберите другой слот.' };
    }

    const appt = this.serviceAppointmentRepo.create({
      serviceId,
      clinicId,
      startTime: start,
      endTime: end,
      patientId: patientId ?? null,
      source: source ?? 'ai',
      comment: comment ?? null,
    });

    const saved = await this.serviceAppointmentRepo.save(appt);
    this.logger.log(`Booked service appointment #${saved.id} at ${start.toISOString()}`);

    return {
      success: true,
      appointmentId: saved.id,
      message:
        `Запись подтверждена! ${serviceExists.name}, ${formatRuDateTime(start)}, ${clinicName}.`,
    };
  }

  // ── Find doctors available at specific time ────────────────────────────────

  private async resolveClinicIdByName(clinicId?: number, clinicName?: string): Promise<number | undefined> {
    if (clinicId) return clinicId;
    if (!clinicName) return undefined;
    const clinic = await this.clinicRepo.findOne({
      where: { name: ILike(`%${clinicName}%`) },
    });
    return clinic ? clinic.id : undefined;
  }

  async findDoctorsAndSlots(params: {
    speciality: string;
    clinicId?: number;
    clinicName?: string;
    date?: string;
    time?: string;
    mode?: SlotMode;
  }): Promise<Array<{
    doctorId: number;
    doctorName: string;
    speciality: string;
    clinicId?: number;
    clinicName?: string;
    isAvailable: boolean;
    requestedDate?: string;
    requestedTime?: string;
    slot?: { date: string; time: string; clinicId: number; clinicName: string } | null;
  }>> {
    const resolvedClinicId = await this.resolveClinicIdByName(params.clinicId, params.clinicName);

    const doctors = await this.findDoctors(params.speciality, resolvedClinicId);
    if (doctors.length === 0) return [];

    const normalizedDate = params.date
      ? (resolveRelativeDate(params.date) ? toDateStr(resolveRelativeDate(params.date)!) : params.date)
      : undefined;

    const mode: SlotMode = params.mode ?? (normalizedDate ? 'day' : 'nearest');

    const results: Array<{
      doctorId: number;
      doctorName: string;
      speciality: string;
      clinicId?: number;
      clinicName?: string;
      isAvailable: boolean;
      requestedDate?: string;
      requestedTime?: string;
      slot?: { date: string; time: string; clinicId: number; clinicName: string } | null;
    }> = [];

    await Promise.all(doctors.map(async (doc) => {
      const item = {
        doctorId: doc.id,
        doctorName: doc.name,
        speciality: doc.speciality,
        clinicId: resolvedClinicId,
        clinicName: params.clinicName,
        isAvailable: false,
        requestedDate: normalizedDate,
        requestedTime: params.time,
        slot: null,
      };

      if (params.time) {
        const dayMode = mode === 'week' ? 'week' : 'day';
        const targetDate = normalizedDate ?? toDateStr(new Date());
        const slots = await this.getDoctorSlots(doc.id, resolvedClinicId, dayMode, targetDate);

        // есть ли точное время на выбранную дату/интервал
        for (const sg of slots) {
          if (sg.times.includes(params.time)) {
            item.isAvailable = true;
            item.slot = {
              date: sg.date,
              time: params.time,
              clinicId: sg.clinicId,
              clinicName: sg.clinicName,
            };
            break;
          }
        }

        if (!item.isAvailable) {
          const nearestSlots = await this.getDoctorSlots(doc.id, resolvedClinicId, 'nearest', normalizedDate);
          if (nearestSlots.length > 0 && nearestSlots[0].times.length > 0) {
            item.slot = {
              date: nearestSlots[0].date,
              time: nearestSlots[0].times[0],
              clinicId: nearestSlots[0].clinicId,
              clinicName: nearestSlots[0].clinicName,
            };
          }
        }
      } else {
        const slots = await this.getDoctorSlots(doc.id, resolvedClinicId, mode, normalizedDate);
        if (slots.length > 0 && slots[0].times.length > 0) {
          item.isAvailable = true;
          item.slot = {
            date: slots[0].date,
            time: slots[0].times[0],
            clinicId: slots[0].clinicId,
            clinicName: slots[0].clinicName,
          };
        }
      }

      results.push(item);
    }));

    return results;
  }

  // ── Find doctors available at specific time ────────────────────────────────

  async findAvailableAtTime(params: {
    speciality: string;
    date: string;       // YYYY-MM-DD or relative word
    time: string;       // HH:MM
    clinicId?: number;
  }): Promise<{ available: (SlotGroup & { doctorId: number; doctorName: string })[]; nearest: (SlotGroup & { doctorId: number; doctorName: string })[] }> {
    const doctors = await this.findDoctors(params.speciality, params.clinicId);
    if (doctors.length === 0) return { available: [], nearest: [] };

    const resolvedDate = resolveRelativeDate(params.date)
      ? toDateStr(resolveRelativeDate(params.date)!)
      : params.date;

    const available: (SlotGroup & { doctorId: number; doctorName: string })[] = [];
    const allNearest: (SlotGroup & { doctorId: number; doctorName: string })[] = [];

    await Promise.all(doctors.map(async (doc) => {
      const daySlots = await this.getDoctorSlots(doc.id, params.clinicId, 'day', resolvedDate);
      let hasTarget = false;
      for (const sg of daySlots) {
        if (sg.times.includes(params.time)) {
          available.push({ ...sg, doctorId: doc.id, doctorName: doc.name });
          hasTarget = true;
        }
      }
      if (!hasTarget) {
        const nearest = await this.getDoctorSlots(doc.id, params.clinicId, 'nearest', resolvedDate);
        for (const sg of nearest) {
          allNearest.push({ ...sg, doctorId: doc.id, doctorName: doc.name });
        }
      }
    }));

    allNearest.sort((a, b) => {
      const ta = new Date(`${a.date}T${a.times[0] ?? '00:00'}`).getTime();
      const tb = new Date(`${b.date}T${b.times[0] ?? '00:00'}`).getTime();
      return ta - tb;
    });

    return { available, nearest: available.length === 0 ? allNearest : [] };
  }

  // ── Patient appointments ───────────────────────────────────────────────────

  /**
   * Returns a human-readable description of a patient's existing appointment
   * at the given time slot, or null if no conflict exists.
   */
  async checkPatientTimeConflict(
    clientId: number,
    startTime: string,
  ): Promise<{ description: string; id: number; type: 'doctor' | 'service' } | null> {
    const start = new Date(startTime);
    const windowMs = 60 * 60 * 1000; // 1 hour window
    const from = new Date(start.getTime() - windowMs);
    const to = new Date(start.getTime() + windowMs);

    const [docAppt, svcAppt] = await Promise.all([
      this.appointmentRepo
        .createQueryBuilder('a')
        .innerJoinAndSelect('a.clinic', 'c')
        .leftJoinAndSelect('a.doctor', 'd')
        .where('a.patient_id = :clientId', { clientId })
        .andWhere('a.start_time >= :from AND a.start_time < :to', { from, to })
        .getOne(),
      this.serviceAppointmentRepo
        .createQueryBuilder('a')
        .innerJoinAndSelect('a.clinic', 'c')
        .innerJoinAndSelect('a.service', 's')
        .where('a.patient_id = :clientId', { clientId })
        .andWhere('a.start_time >= :from AND a.start_time < :to', { from, to })
        .getOne(),
    ]);

    if (docAppt) {
      const d = docAppt as any;
      return {
        id: docAppt.id,
        type: 'doctor',
        description: `${formatRuDateTime(docAppt.startTime)} у ${d.doctor?.name ?? 'врача'} в клинике ${d.clinic.name}`,
      };
    }
    if (svcAppt) {
      const s = svcAppt as any;
      return {
        id: svcAppt.id,
        type: 'service',
        description: `${formatRuDateTime(svcAppt.startTime)} на услугу ${s.service.name} в клинике ${s.clinic.name}`,
      };
    }
    return null;
  }

  async getPatientAppointments(
    clientId: number,
    limit?: number,
  ): Promise<PatientAppointmentItem[]> {
    const now = new Date();

    const [doctorAppts, serviceAppts] = await Promise.all([
      this.appointmentRepo
        .createQueryBuilder('a')
        .innerJoinAndSelect('a.clinic', 'c')
        .leftJoinAndSelect('a.doctor', 'd')
        .leftJoinAndSelect('d.speciality', 's')
        .where('a.patient_id = :clientId', { clientId })
        .andWhere('a.start_time > :now', { now })
        .orderBy('a.start_time', 'ASC')
        .getMany(),

      this.serviceAppointmentRepo
        .createQueryBuilder('a')
        .innerJoinAndSelect('a.clinic', 'c')
        .innerJoinAndSelect('a.service', 'sv')
        .where('a.patient_id = :clientId', { clientId })
        .andWhere('a.start_time > :now', { now })
        .orderBy('a.start_time', 'ASC')
        .getMany(),
    ]);

    const items: (PatientAppointmentItem & { _ts: Date })[] = [
      ...doctorAppts.map((a) => ({
        type: 'doctor' as const,
        date: toDateStr(a.startTime),
        time: toTimeStr(a.startTime),
        clinicName: (a as any).clinic.name,
        doctorName: (a as any).doctor?.name ?? undefined,
        speciality: (a as any).doctor?.speciality?.name ?? undefined,
        _ts: a.startTime,
      })),
      ...serviceAppts.map((a) => ({
        type: 'service' as const,
        date: toDateStr(a.startTime),
        time: toTimeStr(a.startTime),
        clinicName: (a as any).clinic.name,
        serviceName: (a as any).service?.name ?? undefined,
        _ts: a.startTime,
      })),
    ];

    items.sort((a, b) => a._ts.getTime() - b._ts.getTime());

    const result = items.map(({ _ts: _, ...rest }) => rest);
    return limit ? result.slice(0, limit) : result;
  }

  // ── Find appointment for cancellation ─────────────────────────────────────

  async findPatientAppointment(
    clientId: number,
    params: { query?: string; date?: string; time?: string },
  ): Promise<CancellableAppointment[]> {
    const now = new Date();
    const { query, date, time } = params;

    const [doctorAppts, serviceAppts] = await Promise.all([
      this.appointmentRepo
        .createQueryBuilder('a')
        .innerJoinAndSelect('a.clinic', 'c')
        .leftJoinAndSelect('a.doctor', 'd')
        .leftJoinAndSelect('d.speciality', 's')
        .where('a.patient_id = :clientId', { clientId })
        .andWhere('a.start_time > :now', { now })
        .orderBy('a.start_time', 'ASC')
        .getMany(),

      this.serviceAppointmentRepo
        .createQueryBuilder('a')
        .innerJoinAndSelect('a.clinic', 'c')
        .innerJoinAndSelect('a.service', 'sv')
        .where('a.patient_id = :clientId', { clientId })
        .andWhere('a.start_time > :now', { now })
        .orderBy('a.start_time', 'ASC')
        .getMany(),
    ]);

    const results: CancellableAppointment[] = [];

    for (const a of doctorAppts) {
      const doctorName: string = (a as any).doctor?.name ?? '';
      const speciality: string = (a as any).doctor?.speciality?.name ?? '';
      const apptDate = toDateStr(a.startTime);
      const apptTime = toTimeStr(a.startTime);

      const matchesQuery = !query || doctorName.toLowerCase().includes(query.toLowerCase())
        || speciality.toLowerCase().includes(query.toLowerCase());
      const matchesDate = !date || apptDate === date;
      const matchesTime = !time || apptTime.startsWith(time.slice(0, 5));

      if (matchesQuery && matchesDate && matchesTime) {
        results.push({
          id: a.id,
          type: 'doctor',
          date: apptDate,
          time: apptTime,
          clinicId: a.clinicId,
          clinicName: (a as any).clinic.name,
          doctorId: a.doctorId ?? undefined,
          doctorName,
          speciality,
        });
      }
    }

    for (const a of serviceAppts) {
      const serviceName: string = (a as any).service?.name ?? '';
      const apptDate = toDateStr(a.startTime);
      const apptTime = toTimeStr(a.startTime);

      const matchesQuery = !query || serviceName.toLowerCase().includes(query.toLowerCase());
      const matchesDate = !date || apptDate === date;
      const matchesTime = !time || apptTime.startsWith(time.slice(0, 5));

      if (matchesQuery && matchesDate && matchesTime) {
        results.push({
          id: a.id,
          type: 'service',
          date: apptDate,
          time: apptTime,
          clinicId: a.clinicId,
          clinicName: (a as any).clinic.name,
          serviceId: a.serviceId,
          serviceName,
        });
      }
    }

    results.sort((a, b) => {
      const ta = new Date(`${a.date}T${a.time}`).getTime();
      const tb = new Date(`${b.date}T${b.time}`).getTime();
      return ta - tb;
    });

    return results;
  }

  // ── Cancel appointment ─────────────────────────────────────────────────────

  async cancelAppointment(
    id: number,
    type: 'doctor' | 'service',
  ): Promise<{ success: boolean; message: string }> {
    if (type === 'doctor') {
      const appt = await this.appointmentRepo.findOne({ where: { id } });
      if (!appt) return { success: false, message: 'Запись не найдена.' };
      await this.appointmentRepo.delete(id);
      this.logger.log(`Deleted doctor appointment #${id}`);
      return { success: true, message: 'Запись отменена.' };
    } else {
      const appt = await this.serviceAppointmentRepo.findOne({ where: { id } });
      if (!appt) return { success: false, message: 'Запись не найдена.' };
      await this.serviceAppointmentRepo.delete(id);
      this.logger.log(`Deleted service appointment #${id}`);
      return { success: true, message: 'Запись отменена.' };
    }
  }

  // ── Reschedule appointment ─────────────────────────────────────────────────

  async rescheduleAppointment(params: {
    oldId: number;
    type: 'doctor' | 'service';
    doctorId?: number;
    serviceId?: number;
    clinicId: number;
    newStartTime: string;
    patientId?: number;
    comment?: string;
  }): Promise<BookingResult> {
    const { oldId, type, clinicId, newStartTime, patientId, comment } = params;

    // Сначала создаём новую запись — если не получится, старую не трогаем
    const bookResult = await this.bookAppointment({
      doctorId: params.doctorId,
      serviceId: params.serviceId,
      clinicId,
      startTime: newStartTime,
      patientId,
      source: 'ai',
      comment,
    });

    if (!bookResult.success) return bookResult;

    // Новая запись создана — отменяем старую
    await this.cancelAppointment(oldId, type);

    return bookResult;
  }

  // ── Tool definitions ───────────────────────────────────────────────────────

  getTools(): LlmTool[] {
    return [
      {
        name: 'get_clinics',
        description: 'Возвращает список клиник сети. Вызывай, когда нужно узнать ID клиники или предложить пациенту выбор.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'find_doctors',
        description:
          'Находит врачей по специальности или фамилии (нечёткий поиск). ' +
          'Используй, когда нужно найти ID врача или список врачей по специальности. ' +
          'Если пользователь называет фамилию врача — передавай её в поле speciality.',
        parameters: {
          type: 'object',
          properties: {
            speciality: { type: 'string', description: 'Специальность или фамилия врача, например "терапевт", "Нестерова"' },
            clinicId: { type: 'number', description: 'ID клиники (необязательно)' },
          },
          required: ['speciality'],
        },
      },
      {
        name: 'find_services',
        description: 'Находит медицинские услуги по названию (нечёткий поиск).',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Название услуги или её часть, например "УЗИ", "ЭКГ"' },
            clinicId: { type: 'number', description: 'ID клиники (необязательно)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_available_slots',
        description:
          'Возвращает свободные слоты для записи к врачу или на услугу. ' +
          'Режимы: nearest — ближайший день со свободными слотами (используй по умолчанию); ' +
          'day — конкретная дата (только если пациент явно назвал дату); ' +
          'week — вся неделя начиная с targetDate. ' +
          'ВАЖНО: для вопросов "ближайшие окна", "когда можно записаться" — ВСЕГДА используй mode=nearest БЕЗ targetDate. ' +
          'Результат mode=nearest уже содержит первый доступный день — показывай его пациенту напрямую, без упоминания дней в которых слотов нет. ' +
          'В режиме day результат содержит клинику даже если times пустой — врач работает, но слоты заняты.',
        parameters: {
          type: 'object',
          properties: {
            doctorId: { type: 'number', description: 'ID врача' },
            serviceId: { type: 'number', description: 'ID услуги' },
            clinicId: { type: 'number', description: 'ID клиники (необязательно)' },
            mode: {
              type: 'string',
              enum: ['nearest', 'day', 'week'],
              description: 'nearest — ближайшее окно, day — конкретный день, week — неделя',
            },
            targetDate: {
              type: 'string',
              description: 'Дата в формате YYYY-MM-DD. Для nearest — дата начала поиска (по умолчанию сегодня). Для day/week — обязательна.',
            },
          },
          required: [],
        },
      },
      {
        name: 'find_available_at_time',
        description:
          'Проверяет доступность у ВСЕХ врачей заданной специальности на конкретное время. ' +
          'Используй ВМЕСТО get_available_slots когда пациент называет конкретное время (например "в 15:00", "в 9 утра"). ' +
          'Каждый элемент результата содержит doctorId, doctorName, clinicId, clinicName, date, times. ' +
          'available — врачи у которых ЕСТЬ слот на запрошенное время; ' +
          'nearest — ближайшие слоты у врачей у которых запрошенное время занято (только когда available пустой). ' +
          'ВАЖНО: при записи используй ТОЛЬКО doctorId и clinicId из этого результата.',
        parameters: {
          type: 'object',
          properties: {
            speciality: { type: 'string', description: 'Специальность врача, например "Терапевт"' },
            date: { type: 'string', description: 'Дата YYYY-MM-DD или относительное слово: "завтра", "послезавтра", "сегодня"' },
            time: { type: 'string', description: 'Время HH:MM, например "15:00"' },
            clinicId: { type: 'number', description: 'ID клиники (необязательно)' },
          },
          required: ['speciality', 'date', 'time'],
        },
      },
      {
        name: 'find_doctors_and_slots',
        description:
          'Ищет врачей по специальности / фамилии и возвращает их доступность. ' +
          'Если передано time, возвращает isAvailable для этого времени и ближайший свободный слот, если время занято. ' +
          'Если time не задан, возвращает ближайший свободный слот в указанном интервале (mode: nearest/day/week).',
        parameters: {
          type: 'object',
          properties: {
            speciality: { type: 'string', description: 'Специальность или фамилия врача' },
            clinicId: { type: 'number', description: 'ID клиники (необязательно)' },
            clinicName: { type: 'string', description: 'Название клиники (необязательно)' },
            date: { type: 'string', description: 'Дата YYYY-MM-DD или относительное слово (например "завтра")' },
            time: { type: 'string', description: 'Желаемое время HH:MM (необязательно)' },
            mode: {
              type: 'string',
              enum: ['nearest', 'day', 'week'],
              description: 'Если задан, используется для поиска ближайших слотов (по умолчанию nearest).',
            },
          },
          required: ['speciality'],
        },
      },
      {
        name: 'find_patient_appointment',
        description:
          'Ищет предстоящие записи пациента (к врачам и на услуги) для отмены или переноса. ' +
          'Все параметры необязательны — передавай только то, что известно из запроса пациента. ' +
          'Если пациент назвал только дату — передавай только date, без query. ' +
          'Если пациент назвал только специальность или врача — передавай только query. ' +
          'Возвращает список совпадений с id, doctorId/serviceId, clinicId каждой записи.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Имя врача, фамилия или специальность, либо название процедуры' },
            date: { type: 'string', description: 'Дата записи YYYY-MM-DD' },
            time: { type: 'string', description: 'Время записи HH:MM' },
            dayOfMonth: { type: 'number', description: 'Число месяца (1–31) когда пациент говорит "на 26-е", "26 числа" и т.д. Бэкенд найдёт ближайшую дату с этим числом.' },
            dayOfWeek: { type: 'string', description: 'День недели на русском — "понедельник", "вторник" и т.д. Бэкенд автоматически вычислит ближайшую дату этого дня.' },
            timeExpression: { type: 'string', description: 'Разговорное время — "9 утра", "6 вечера", "9:30 утра", "14:00" и т.д. Бэкенд переведёт в HH:MM.' },
          },
          required: [],
        },
      },
      {
        name: 'reschedule_appointment',
        description:
          'Переносит запись пациента: атомарно создаёт новую запись и отменяет старую. ' +
          'Вызывай ТОЛЬКО после того как пациент подтвердил перенос. ' +
          'oldId, type, doctorId/serviceId и clinicId берутся из результата find_patient_appointment.',
        parameters: {
          type: 'object',
          properties: {
            oldId:        { type: 'number', description: 'ID старой записи из find_patient_appointment' },
            type:         { type: 'string', enum: ['doctor', 'service'], description: 'Тип записи' },
            doctorId:     { type: 'number', description: 'ID врача (для doctor)' },
            serviceId:    { type: 'number', description: 'ID услуги (для service)' },
            clinicId:     { type: 'number', description: 'ID клиники из find_patient_appointment' },
            newStartTime: { type: 'string', description: 'Новое время записи ISO 8601, например "2026-03-27T09:30:00"' },
            comment:      { type: 'string', description: 'Имя пациента или комментарий' },
          },
          required: ['oldId', 'type', 'clinicId', 'newStartTime'],
        },
      },
      {
        name: 'cancel_appointment',
        description:
          'Отменяет запись пациента. Вызывай ТОЛЬКО после того как пациент подтвердил отмену. ' +
          'ID берётся из результата find_patient_appointment.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'ID записи из результата find_patient_appointment' },
            type: { type: 'string', enum: ['doctor', 'service'], description: 'Тип записи' },
          },
          required: ['id', 'type'],
        },
      },
      {
        name: 'get_patient_appointments',
        description:
          'Возвращает предстоящие записи текущего пациента к врачам и на процедуры, отсортированные по времени. ' +
          'ОБЯЗАТЕЛЬНО вызывай этот инструмент когда пациент говорит: "покажи мои записи", "мои записи", ' +
          '"когда я записан", "есть ли у меня запись", "ближайшая запись", "покажи расписание" и любые похожие запросы. ' +
          'Передай limit=1 ТОЛЬКО если пациент явно просит ближайшую запись.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Максимальное число записей (1 — только ближайшая). Не передавай для показа всех.' },
          },
          required: [],
        },
      },
      {
        name: 'book_appointment',
        description:
          'Записывает пациента к врачу или на услугу. ' +
          'СТОП — НЕ вызывай этот инструмент пока пациент не произнёс явное слово-подтверждение: "да", "подтверждаю", "записывайте", "конечно". ' +
          'Выбор врача ("Нестерова", "запишите к Касумову") — НЕ является подтверждением. ' +
          'После выбора врача и времени ОБЯЗАТЕЛЬНО выведи сводку (врач, дата, время, клиника) и задай вопрос "Подтверждаете запись?" — затем жди ответа. ' +
          'Имя пациента спрашивать не нужно — он идентифицирован автоматически.',
        parameters: {
          type: 'object',
          properties: {
            doctorId: { type: 'number', description: 'ID врача' },
            serviceId: { type: 'number', description: 'ID услуги' },
            clinicId: { type: 'number', description: 'ID клиники' },
            startTime: { type: 'string', description: 'Дата и время начала, ISO 8601, например "2026-03-25T10:00:00"' },
            comment: { type: 'string', description: 'Дополнительный комментарий (необязательно)' },
          },
          required: ['clinicId', 'startTime'],
        },
      },
    ];
  }

  async executeTool(
    name: string,
    args: Record<string, any>,
    _sessionId?: string,
    clientId?: number,
  ): Promise<unknown> {
    try {
      switch (name) {
        case 'get_clinics':
          return this.getClinics();
        case 'find_doctors':
          return this.findDoctors(args.speciality, args.clinicId);
        case 'find_services':
          return this.findServices(args.query, args.clinicId);
        case 'get_available_slots':
          return this.getAvailableSlots(args);
        case 'find_available_at_time':
          return this.findAvailableAtTime({
            speciality: args.speciality,
            date: args.date,
            time: args.time,
            clinicId: args.clinicId,
          });
        case 'find_doctors_and_slots':
          return this.findDoctorsAndSlots({
            speciality: args.speciality,
            clinicId: args.clinicId,
            clinicName: args.clinicName,
            date: args.date,
            time: args.time,
            mode: args.mode,
          });
        case 'get_patient_appointments': {
          if (!clientId) return { error: 'Пациент не идентифицирован. Функция доступна только авторизованным пользователям.' };
          return this.getPatientAppointments(clientId, args.limit);
        }
        case 'find_patient_appointment': {
          if (!clientId) return { error: 'Пациент не идентифицирован. Функция доступна только авторизованным пользователям.' };
          const apptArgs = { ...args };
          if (apptArgs.dayOfMonth && !apptArgs.date) {
            const resolved = nearestDayOfMonth(Number(apptArgs.dayOfMonth));
            if (resolved) apptArgs.date = resolved;
          }
          if (apptArgs.dayOfWeek && !apptArgs.date) {
            const resolved = nearestWeekdayDate(apptArgs.dayOfWeek);
            if (resolved) apptArgs.date = resolved;
          }
          if (apptArgs.timeExpression && !apptArgs.time) {
            const resolved = parseTimeExpression(apptArgs.timeExpression);
            if (resolved) apptArgs.time = resolved;
          }
          return this.findPatientAppointment(clientId, apptArgs);
        }
        case 'reschedule_appointment': {
          if (!clientId) return { error: 'Пациент не идентифицирован.' };
          return this.rescheduleAppointment({ ...args as any, patientId: clientId });
        }
        case 'cancel_appointment': {
          if (!clientId) return { error: 'Пациент не идентифицирован.' };
          return this.cancelAppointment(args.id, args.type);
        }
        case 'book_appointment': {
          const bookArgs = { ...args } as Parameters<BookingService['bookAppointment']>[0];
          // Inject external client ID from session (stored as patient_id in appointments)
          if (!bookArgs.patientId && clientId) {
            bookArgs.patientId = clientId;
          }
          return this.bookAppointment(bookArgs);
        }
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      this.logger.error(`Tool ${name} error: ${String(err)}`);
      return { error: `Ошибка при выполнении ${name}. Пожалуйста, уточни данные и попробуй снова.` };
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatRuDateTime(date: Date): string {
  const d = date.getDate();
  const mon = RU_MONTHS[date.getMonth()];
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d} ${mon} ${y} в ${hh}:${mm}`;
}

/**
 * Преобразует разговорное время в HH:MM
 * Примеры: "9 утра" → "09:00", "6 вечера" → "18:00", "9:30 утра" → "09:30"
 */
function parseTimeExpression(expr: string): string | null {
  const clean = expr.trim().toLowerCase();
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(утра|дня|вечера|ночи|часов|час)?$/);
  if (!match) return null;

  let h = parseInt(match[1]);
  const m = parseInt(match[2] ?? '0');
  const period = match[3] ?? '';

  if (period === 'утра') {
    if (h === 12) h = 0;               // 12 утра = полночь
  } else if (period === 'дня' || period === 'вечера') {
    if (h !== 12) h += 12;             // 1 дня = 13:00, 6 вечера = 18:00
  } else if (period === 'ночи') {
    if (h === 12) h = 0;               // 12 ночи = полночь
    // 1-5 ночи остаются как есть
  }

  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Возвращает YYYY-MM-DD ближайшей будущей даты с данным числом месяца.
 * Например, dayOfMonth=26 → ближайшее 26-е (текущего или следующего месяца).
 */
function nearestDayOfMonth(day: number): string | null {
  if (day < 1 || day > 31) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(today.getFullYear(), today.getMonth(), day);
  if (candidate < today) {
    // Уже прошло в этом месяце — берём следующий
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return toDateStr(candidate);
}

/** Возвращает YYYY-MM-DD ближайшего предстоящего дня недели (включая сегодня) */
function nearestWeekdayDate(dayName: string): string | null {
  const map: Record<string, number> = {
    понедельник: 1, вторник: 2, среда: 3, среду: 3,
    четверг: 4, пятница: 5, пятницу: 5, суббота: 6, субботу: 6,
    воскресенье: 0,
  };
  const target = map[dayName.toLowerCase().trim()];
  if (target === undefined) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const current = today.getDay();
  const diff = (target - current + 7) % 7;
  const result = new Date(today);
  result.setDate(today.getDate() + diff);
  return toDateStr(result);
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeStr(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function generateSlots(
  date: Date,
  startTime: string,
  endTime: string,
  durationMins: number,
  breakStart?: string | null,
  breakEnd?: string | null,
): Date[] {
  const slots: Date[] = [];
  const startM = toMinutes(startTime);
  const endM = toMinutes(endTime);
  const bsM = breakStart ? toMinutes(breakStart) : null;
  const beM = breakEnd ? toMinutes(breakEnd) : null;

  for (let m = startM; m + durationMins <= endM; m += durationMins) {
    // Пропускаем слоты, перекрывающиеся с перерывом
    if (bsM !== null && beM !== null && m < beM && m + durationMins > bsM) continue;
    const slot = new Date(date);
    slot.setHours(Math.floor(m / 60), m % 60, 0, 0);
    slots.push(slot);
  }
  return slots;
}

function resolveRelativeDate(expr: string): Date | null {
  const s = expr.trim().toLowerCase();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (s === 'сегодня') return today;
  if (s === 'завтра') { const d = new Date(today); d.setDate(d.getDate() + 1); return d; }
  if (s === 'послезавтра') { const d = new Date(today); d.setDate(d.getDate() + 2); return d; }
  return null;
}

function buildDateRange(mode: SlotMode, targetDate?: string): { from: Date; days: number } {
  let from: Date;
  if (targetDate) {
    // Try relative words first ("завтра", "послезавтра", "сегодня")
    const relative = resolveRelativeDate(targetDate);
    if (relative) {
      from = relative;
    } else {
      // Parse YYYY-MM-DD as local date to avoid UTC offset shifting the date
      const parts = targetDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (parts) {
        let y = parseInt(parts[1]);
        const m = parseInt(parts[2]);
        const d = parseInt(parts[3]);
        // If LLM provides a past year, substitute current year
        const currentYear = new Date().getFullYear();
        if (y < currentYear) y = currentYear;
        from = new Date(y, m - 1, d, 0, 0, 0, 0);
      } else {
        from = new Date();
        from.setHours(0, 0, 0, 0);
      }
    }
  } else {
    from = new Date();
    from.setHours(0, 0, 0, 0);
  }

  const days =
    mode === 'nearest' ? DEFAULT_SEARCH_DAYS :
    mode === 'day'     ? 1 :
    /* week */           7;

  return { from, days };
}
