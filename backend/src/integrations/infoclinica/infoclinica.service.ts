/**
 * NestJS-сервис для работы с МИС Инфоклиника.
 * Выбирает mock или реальный HTTP-клиент на основе INFOCLINICA_USE_MOCK.
 * Переводит типы IC в внутренние типы BookingService.
 */

import { Injectable, Logger } from '@nestjs/common';
import { IInfclinicaClient } from './infoclinica.types';
import { InfclinicaMockClient } from './infoclinica.mock';
import {
  toClinics,
  toDoctors,
  toSlotGroups,
  toBookingResult,
  isoToIcDate,
  icDateToIso,
  IcStoredAppointment,
  toPatientAppointmentItem,
  toCancellableAppointment,
} from './infoclinica.adapter';
import {
  ClinicInfo,
  DoctorInfo,
  SlotGroup,
  BookingResult,
  PatientAppointmentItem,
  CancellableAppointment,
  SlotMode,
} from '../../booking/booking.service';

@Injectable()
export class InfclinicaService {
  private readonly logger = new Logger(InfclinicaService.name);
  private readonly client: IInfclinicaClient;

  /** In-memory хранилище записей, созданных через IC (для mock-режима). */
  private readonly storedAppointments = new Map<number, IcStoredAppointment>();

  constructor() {
    const useMock = process.env.INFOCLINICA_USE_MOCK !== 'false';
    this.client = new InfclinicaMockClient();
    this.logger.log(`InfclinicaService started (${useMock ? 'MOCK' : 'REAL'} mode)`);
  }

  // ── Справочники ──────────────────────────────────────────────────────────────

  async getClinics(): Promise<ClinicInfo[]> {
    const filials = await this.client.getFilialList();
    return toClinics(filials);
  }

  async findDoctors(speciality: string, filialId?: number): Promise<DoctorInfo[]> {
    const icDoctors = await this.client.getDoctorList(filialId);
    const q = speciality.toLowerCase();
    const filtered = icDoctors.filter(
      (d) => d.DNAME.toLowerCase().includes(q) || d.DEPNAME.toLowerCase().includes(q),
    );
    return toDoctors(filtered);
  }

  // ── Слоты ────────────────────────────────────────────────────────────────────

  async getAvailableSlots(params: {
    doctorId: number;
    filialId?: number;
    mode?: SlotMode;
    targetDate?: string;
  }): Promise<SlotGroup[]> {
    const { doctorId, filialId, mode = 'nearest', targetDate } = params;

    const fromDate = targetDate ? new Date(`${targetDate}T00:00:00`) : new Date();
    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + (mode === 'week' ? 14 : 14));

    const fromStr = isoToIcDate(fromDate.toISOString().slice(0, 10));
    const toStr = isoToIcDate(toDate.toISOString().slice(0, 10));

    const [slots, filials] = await Promise.all([
      this.client.getFreeSlots(doctorId, fromStr, toStr, filialId),
      this.client.getFilialList(),
    ]);

    // Отфильтровываем прошедшее время
    const now = new Date();
    const futureSlots = slots.filter((s) => {
      if (s.FREETYPE !== 0) return false;
      const slotTime = new Date(
        `${icDateToIso(s.WDATE)}T${String(s.BHOUR).padStart(2, '0')}:${String(s.BMIN).padStart(2, '0')}:00`,
      );
      return slotTime > now;
    });

    return toSlotGroups(futureSlots, filials, mode);
  }

  // ── Запись ───────────────────────────────────────────────────────────────────

  async bookAppointment(params: {
    doctorId: number;
    clinicId: number; // = filialId в IC
    startTime: string; // ISO-строка
    patientId?: number;
    comment?: string;
  }): Promise<BookingResult> {
    const { doctorId, clinicId, startTime, patientId, comment } = params;

    const start = new Date(startTime);
    if (start <= new Date()) {
      return { success: false, message: 'Нельзя записаться на прошедшее время. Пожалуйста, выберите будущий слот.' };
    }

    const end = new Date(start.getTime() + 30 * 60_000);

    // Ищем врача в IC
    const icDoctors = await this.client.getDoctorList(clinicId);
    const doctor = icDoctors.find((d) => d.DCODE === doctorId);
    if (!doctor) {
      return { success: false, message: `Врач с id=${doctorId} не найден в МИС. Используй find_doctors для получения корректного ID.` };
    }

    // Получаем SHEDIDENT нужного слота
    const workDateStr = isoToIcDate(startTime.slice(0, 10));
    const slots = await this.client.getFreeSlots(doctorId, workDateStr, workDateStr, clinicId);
    const targetSlot = slots.find(
      (s) => s.BHOUR === start.getHours() && s.BMIN === start.getMinutes(),
    );
    if (!targetSlot) {
      return { success: false, message: 'Выбранное время не найдено в расписании. Пожалуйста, выберите другой слот.' };
    }

    const icResult = await this.client.bookAppointment(
      {
        DCODE: doctorId,
        WORKDATE: workDateStr,
        BHOUR: start.getHours(),
        BMIN: start.getMinutes(),
        FHOUR: end.getHours(),
        FMIN: end.getMinutes(),
        SHEDIDENT: targetSlot.SHEDIDENT,
        DEPNUM: doctor.DEPNUM,
        PCODE: -1, // анонимная запись
        ANOTE: comment,
        ONLINETYPE: 0,
      },
      clinicId,
    );

    if (icResult.SPRESULT !== 1) {
      return toBookingResult(icResult);
    }

    const schedId = icResult.SCHEDID!;
    const isoDate = icDateToIso(workDateStr);
    const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;

    // Сохраняем запись локально для последующего отображения / отмены
    this.storedAppointments.set(schedId, {
      id: schedId,
      filialId: clinicId,
      doctorCode: doctorId,
      doctorName: doctor.DNAME,
      clinicName: doctor.FNAME,
      depName: doctor.DEPNAME,
      date: isoDate,
      time: timeStr,
      patientId,
    });

    this.logger.log(`IC booking #${schedId}: ${doctor.DNAME} ${isoDate} ${timeStr}`);

    return {
      success: true,
      appointmentId: schedId,
      message: `Запись подтверждена! ${doctor.DNAME}, ${formatRuDateTime(start)}, ${doctor.FNAME}.`,
    };
  }

  async cancelAppointment(
    schedId: number,
    filialId: number,
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.client.cancelAppointment(schedId, filialId);
    if (result.SPRESULT === 1) {
      this.storedAppointments.delete(schedId);
    }
    return { success: result.SPRESULT === 1, message: result.SPCOMMENT };
  }

  // ── Записи пациента ──────────────────────────────────────────────────────────

  async getPatientAppointments(clientId: number, limit?: number): Promise<PatientAppointmentItem[]> {
    const now = new Date();
    const items = [...this.storedAppointments.values()]
      .filter((a) => a.patientId === clientId && new Date(`${a.date}T${a.time}:00`) > now)
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
      .map(toPatientAppointmentItem);
    return limit ? items.slice(0, limit) : items;
  }

  async findPatientAppointment(
    clientId: number,
    params: { query?: string; date?: string; time?: string },
  ): Promise<CancellableAppointment[]> {
    const now = new Date();
    const { query, date, time } = params;

    return [...this.storedAppointments.values()]
      .filter((a) => {
        if (a.patientId !== clientId) return false;
        if (new Date(`${a.date}T${a.time}:00`) <= now) return false;
        if (date && a.date !== date) return false;
        if (time && !a.time.startsWith(time.slice(0, 5))) return false;
        if (query) {
          const q = query.toLowerCase();
          if (!a.doctorName.toLowerCase().includes(q) && !a.depName.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
      .map(toCancellableAppointment);
  }

  // ── Маршрутизатор tool-вызовов ────────────────────────────────────────────────

  async executeTool(name: string, args: Record<string, any>, clientId?: number): Promise<unknown> {
    switch (name) {
      case 'get_clinics':
        return this.getClinics();

      case 'find_doctors':
        return this.findDoctors(args.speciality, args.clinicId);

      case 'find_services':
        // IC не поддерживает поиск услуг в текущей реализации
        return [];

      case 'get_available_slots':
        return this.getAvailableSlots({
          doctorId: args.doctorId,
          filialId: args.clinicId,
          mode: args.mode,
          targetDate: args.targetDate,
        });

      case 'find_doctors_and_slots': {
        const doctors = await this.findDoctors(args.speciality, args.clinicId);
        if (doctors.length === 0) return [];

        const mode: SlotMode = args.mode ?? (args.date ? 'day' : 'nearest');
        const results = await Promise.all(
          doctors.map(async (doc) => {
            const slots = await this.getAvailableSlots({
              doctorId: doc.id,
              filialId: args.clinicId,
              mode,
              targetDate: args.date,
            });
            const first = slots[0];
            return {
              doctorId: doc.id,
              doctorName: doc.name,
              speciality: doc.speciality,
              isAvailable: first != null && first.times.length > 0,
              slot: first && first.times.length > 0
                ? { date: first.date, time: first.times[0], clinicId: first.clinicId, clinicName: first.clinicName }
                : null,
              allSlots: mode === 'day'
                ? slots.flatMap((sg) => sg.times.map((t) => ({ date: sg.date, time: t, clinicId: sg.clinicId, clinicName: sg.clinicName })))
                : undefined,
            };
          }),
        );
        return results;
      }

      case 'find_available_at_time': {
        const doctors = await this.findDoctors(args.speciality, args.clinicId);
        const available: unknown[] = [];
        const nearest: unknown[] = [];
        await Promise.all(
          doctors.map(async (doc) => {
            const slots = await this.getAvailableSlots({
              doctorId: doc.id,
              filialId: args.clinicId,
              mode: 'day',
              targetDate: args.date,
            });
            const hasTime = slots.some((sg) => sg.times.includes(args.time));
            if (hasTime) {
              const sg = slots.find((sg) => sg.times.includes(args.time))!;
              available.push({ ...sg, doctorId: doc.id, doctorName: doc.name });
            } else {
              const ns = await this.getAvailableSlots({ doctorId: doc.id, filialId: args.clinicId, mode: 'nearest' });
              if (ns.length > 0) nearest.push({ ...ns[0], doctorId: doc.id, doctorName: doc.name });
            }
          }),
        );
        return { available, nearest: available.length === 0 ? nearest : [] };
      }

      case 'book_appointment':
        return this.bookAppointment({
          doctorId: args.doctorId,
          clinicId: args.clinicId,
          startTime: args.startTime,
          patientId: clientId,
          comment: args.comment,
        });

      case 'cancel_appointment': {
        if (!clientId) return { error: 'Пациент не идентифицирован.' };
        const stored = this.storedAppointments.get(args.id);
        if (!stored) return { success: false, message: 'Запись не найдена.' };
        return this.cancelAppointment(args.id, stored.filialId);
      }

      case 'reschedule_appointment': {
        if (!clientId) return { error: 'Пациент не идентифицирован.' };
        const bookResult = await this.bookAppointment({
          doctorId: args.doctorId,
          clinicId: args.clinicId,
          startTime: args.newStartTime,
          patientId: clientId,
          comment: args.comment,
        });
        if (!bookResult.success) return bookResult;
        const stored = this.storedAppointments.get(args.oldId);
        if (stored) await this.cancelAppointment(args.oldId, stored.filialId);
        return bookResult;
      }

      case 'get_patient_appointments':
        if (!clientId) return { error: 'Пациент не идентифицирован. Функция доступна только авторизованным пользователям.' };
        return this.getPatientAppointments(clientId, args.limit);

      case 'find_patient_appointment':
        if (!clientId) return { error: 'Пациент не идентифицирован. Функция доступна только авторизованным пользователям.' };
        return this.findPatientAppointment(clientId, args);

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}

// ── Утилиты ───────────────────────────────────────────────────────────────────

function formatRuDateTime(d: Date): string {
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]}, ${h}:${m}`;
}
