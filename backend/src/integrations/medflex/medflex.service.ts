/**
 * NestJS-сервис интеграции с MedFlex.
 *
 * Получает apiKey из clinic_nets.medflex_key (передаётся из BookingService).
 * Каждый метод делает запрос к MedFlex API с ключом клиники.
 *
 * TODO: реализовать после получения документации MedFlex API.
 */

import { Injectable, Logger } from '@nestjs/common';
import { LlmTool } from '../../llm/llm.types';
import {
  ClinicInfo,
  DoctorInfo,
  SlotGroup,
  BookingResult,
  PatientAppointmentItem,
  CancellableAppointment,
} from '../../booking/booking.service';

@Injectable()
export class MedflexService {
  private readonly logger = new Logger(MedflexService.name);

  // ── Инструменты LLM ──────────────────────────────────────────────────────────
  //
  // Набор инструментов MedFlex может отличаться от стандартного.
  // Добавляй / убирай инструменты после уточнения возможностей API.

  getTools(): LlmTool[] {
    return [
      {
        name: 'get_clinics',
        description: 'Возвращает список клиник сети. Вызывай, когда нужно узнать ID клиники или предложить пациенту выбор.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'find_doctors',
        description: 'Находит врачей по специальности или фамилии.',
        parameters: {
          type: 'object',
          properties: {
            speciality: { type: 'string', description: 'Специальность или фамилия врача' },
            clinicId:   { type: 'number', description: 'ID клиники (необязательно)' },
          },
          required: ['speciality'],
        },
      },
      {
        name: 'get_available_slots',
        description:
          'Возвращает свободные слоты для записи к врачу. ' +
          'Режимы: nearest — ближайший свободный день (по умолчанию); ' +
          'day — конкретная дата; week — неделя.',
        parameters: {
          type: 'object',
          properties: {
            doctorId:   { type: 'number', description: 'ID врача' },
            clinicId:   { type: 'number', description: 'ID клиники (необязательно)' },
            mode:       { type: 'string', enum: ['nearest', 'day', 'week'] },
            targetDate: { type: 'string', description: 'Дата YYYY-MM-DD (для режима day/week)' },
            dayOfWeek:  { type: 'string', description: 'День недели на русском ("понедельник" и т.п.)' },
            nextWeek:   { type: 'boolean', description: 'true — следующая неделя' },
          },
          required: [],
        },
      },
      {
        name: 'book_appointment',
        description:
          'Записывает пациента к врачу. ' +
          'Вызывай ТОЛЬКО после явного подтверждения пациентом. ' +
          'Перед записью обязательно покажи сводку и спроси "Подтверждаете запись?".',
        parameters: {
          type: 'object',
          properties: {
            doctorId:  { type: 'number', description: 'ID врача' },
            clinicId:  { type: 'number', description: 'ID клиники' },
            startTime: { type: 'string', description: 'Дата и время ISO 8601, например "2026-05-10T10:00:00"' },
            comment:   { type: 'string', description: 'Комментарий (необязательно)' },
          },
          required: ['doctorId', 'clinicId', 'startTime'],
        },
      },
      {
        name: 'cancel_appointment',
        description: 'Отменяет запись пациента. Вызывай ТОЛЬКО после явного подтверждения.',
        parameters: {
          type: 'object',
          properties: {
            id:   { type: 'number', description: 'ID записи' },
            type: { type: 'string', enum: ['doctor', 'service'] },
          },
          required: ['id', 'type'],
        },
      },
      {
        name: 'get_patient_appointments',
        description: 'Возвращает предстоящие записи пациента.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Максимальное число записей' },
          },
          required: [],
        },
      },
    ];
  }

  // ── Маршрутизатор tool-вызовов ────────────────────────────────────────────────

  async executeTool(
    name: string,
    args: Record<string, any>,
    clientId?: number,
    apiKey?: string | null,
  ): Promise<unknown> {
    if (!apiKey) {
      this.logger.warn(`MedFlex tool '${name}' called without API key`);
      return { error: 'Ключ интеграции MedFlex не настроен. Обратитесь к администратору.' };
    }

    try {
      switch (name) {
        case 'get_clinics':
          return this.getClinics(apiKey);
        case 'find_doctors':
          return this.findDoctors(args.speciality, args.clinicId, apiKey);
        case 'get_available_slots':
          return this.getAvailableSlots({ doctorId: args.doctorId, clinicId: args.clinicId, mode: args.mode, targetDate: args.targetDate }, apiKey);
        case 'book_appointment':
          return this.bookAppointment({ doctorId: args.doctorId, clinicId: args.clinicId, startTime: args.startTime, patientId: clientId, comment: args.comment }, apiKey);
        case 'cancel_appointment':
          if (!clientId) return { error: 'Пациент не идентифицирован.' };
          return this.cancelAppointment(args.id, apiKey);
        case 'get_patient_appointments':
          if (!clientId) return { error: 'Пациент не идентифицирован.' };
          return this.getPatientAppointments(clientId, apiKey, args.limit);
        default:
          return { error: `Инструмент '${name}' не поддерживается в MedFlex.` };
      }
    } catch (err) {
      this.logger.error(`MedFlex tool ${name} error: ${String(err)}`);
      return { error: `Ошибка при выполнении ${name}. Пожалуйста, уточни данные и попробуй снова.` };
    }
  }

  // ── Методы API ───────────────────────────────────────────────────────────────
  // TODO: реализовать HTTP-запросы к MedFlex API после получения документации.

  async getClinics(_apiKey: string): Promise<ClinicInfo[]> {
    this.logger.warn('MedFlex getClinics: not yet implemented');
    return [];
  }

  async findDoctors(_speciality: string, _clinicId: number | undefined, _apiKey: string): Promise<DoctorInfo[]> {
    this.logger.warn('MedFlex findDoctors: not yet implemented');
    return [];
  }

  async getAvailableSlots(
    _params: { doctorId: number; clinicId?: number; mode?: string; targetDate?: string },
    _apiKey: string,
  ): Promise<SlotGroup[]> {
    this.logger.warn('MedFlex getAvailableSlots: not yet implemented');
    return [];
  }

  async bookAppointment(
    _params: { doctorId: number; clinicId: number; startTime: string; patientId?: number; comment?: string },
    _apiKey: string,
  ): Promise<BookingResult> {
    this.logger.warn('MedFlex bookAppointment: not yet implemented');
    return { success: false, message: 'Интеграция с MedFlex в процессе разработки. Запись временно недоступна.' };
  }

  async cancelAppointment(_appointmentId: number, _apiKey: string): Promise<{ success: boolean; message: string }> {
    this.logger.warn('MedFlex cancelAppointment: not yet implemented');
    return { success: false, message: 'Интеграция с MedFlex в процессе разработки.' };
  }

  async getPatientAppointments(
    _clientId: number,
    _apiKey: string,
    _limit?: number,
  ): Promise<PatientAppointmentItem[]> {
    this.logger.warn('MedFlex getPatientAppointments: not yet implemented');
    return [];
  }
}
