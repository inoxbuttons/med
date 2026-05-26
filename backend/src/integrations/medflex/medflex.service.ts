/**
 * NestJS-сервис интеграции с MedFlex.
 *
 * Получает apiKey из clinic_nets.medflex_key.
 * Получает lpuGroupId из session.clinicNetId (= MedFlex lpu_group_id).
 *
 * Специальности кэшируются in-memory (TTL 60 мин) для поиска по имени.
 * Список клиник кэшируется per-group (TTL 10 мин).
 */

import { Injectable, Logger } from '@nestjs/common';
import { LlmTool } from '../../llm/llm.types';
import { MedflexClient } from './medflex.client';
import { MfSpeciality, MfLpu, MfDoctor, MfService } from './medflex.types';
import {
  ClinicInfo,
  DoctorInfo,
  SlotGroup,
  BookingResult,
  PatientAppointmentItem,
  CancellableAppointment,
  SlotMode,
} from '../../booking/booking.service';
import { PatientData } from '../../chat/chat.types';
import { toDateStr, parseFlexibleDate, normalizeDayWord, formatRuDateLabel, nextWeekdayDate } from '../shared/date-utils';
import { normalizeRuPhone } from '../shared/phone-utils';
import { isPlaceholderValue, isMissingPhone, isMissingBirthday } from '../shared/patient-data-utils';

// ── Кэш специальностей ────────────────────────────────────────────────────────

interface SpecialityCache {
  data: MfSpeciality[];
  fetchedAt: number;
}

interface LpuCache {
  lpus: MfLpu[];
  fetchedAt: number;
}

const SPECIALITY_TTL_MS = 60 * 60 * 1000; // 60 мин
const LPU_TTL_MS = 10 * 60 * 1000;        // 10 мин

@Injectable()
export class MedflexService {
  private readonly logger = new Logger(MedflexService.name);

  /** Глобальный кэш специальностей (одинаков для всех клиник) */
  private specialityCache: Map<string, SpecialityCache> = new Map();

  /** Кэш клиник per lpu_group_id */
  private lpuCache: Map<number, LpuCache> = new Map();

  // ── LLM инструменты ──────────────────────────────────────────────────────────

  /**
   * @param hasPatient true — пациент авторизован (есть session.patient).
   *                   false/undefined — гостевой режим: данные пациента собираем у пользователя при записи,
   *                   операции с существующими записями (поиск/отмена) недоступны.
   */
  getTools(hasPatient?: boolean): LlmTool[] {
    const tools: LlmTool[] = [
      {
        name: 'get_clinics',
        description: 'Список клиник сети.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'find_doctors',
        description:
          'Поиск врачей по специальности или фамилии (поле speciality). ' +
          'Возвращает id, name, speciality, specialityId, price, clinics. ' +
          'specialityId нужен для book_appointment.',
        parameters: {
          type: 'object',
          properties: {
            speciality: { type: 'string', description: 'Специальность или фамилия ("терапевт", "Иванова")' },
            clinicId:   { type: 'number', description: 'ID клиники (lpu_id), опционально' },
          },
          required: ['speciality'],
        },
      },
      {
        name: 'find_doctors_and_slots',
        description:
          'Поиск врачей по СПЕЦИАЛЬНОСТИ или ФАМИЛИИ + ближайшие слоты. Используй для "к терапевту", "к Ивановой". ' +
          'НЕ используй для конкретных процедур ("УЗИ сердца", "пилинг") — для них find_services. ' +
          'Возвращает doctorId, doctorName, speciality, specialityId, price, slot{date,time,clinicId,clinicName}; при mode=day также allSlots. ' +
          'Для слов "вторник"/"завтра" используй dayOfWeek, НЕ date.',
        parameters: {
          type: 'object',
          properties: {
            speciality: { type: 'string', description: 'Специальность или фамилия' },
            clinicId:   { type: 'number', description: 'ID клиники, опционально' },
            date:       { type: 'string', description: 'YYYY-MM-DD — только для явных дат с числом' },
            dayOfWeek:  { type: 'string', description: '"понедельник"…"воскресенье" / "сегодня"/"завтра"/"послезавтра"' },
            nextWeek:   { type: 'boolean', description: 'true для "следующей недели"' },
            mode: {
              type: 'string',
              enum: ['nearest', 'day', 'week'],
              description: 'nearest (по умолч.) / day / week',
            },
          },
          required: ['speciality'],
        },
      },
      {
        name: 'find_services',
        description:
          'Поиск медицинской УСЛУГИ (процедуры, исследования) по названию: "УЗИ сердца", "пилинг", "ботокс", "чистка лица". ' +
          'Используй ВМЕСТО find_doctors_and_slots, когда пациент называет процедуру/исследование, а не специальность врача. ' +
          'Если пациент назвал день («в субботу», «завтра», «на следующей неделе») — передавай dayOfWeek/nextWeek/date, иначе вернётся ближайший слот. ' +
          'Возвращает: serviceId, serviceName, duration, price (цена услуги), doctorId, doctorName, speciality, specialityId, slot{date,time,clinicId,clinicName}. ' +
          'Для записи в book_appointment передавай specialityId (специальность врача из этого результата) и price (цена услуги).',
        parameters: {
          type: 'object',
          properties: {
            query:     { type: 'string', description: 'Название услуги или часть ("УЗИ сердца", "пилинг")' },
            clinicId:  { type: 'number', description: 'ID клиники, опционально' },
            dayOfWeek: { type: 'string', description: '"понедельник"…"воскресенье" / "сегодня"/"завтра"/"послезавтра"' },
            nextWeek:  { type: 'boolean', description: 'true для «следующей недели»' },
            date:      { type: 'string', description: 'YYYY-MM-DD — только для явных дат с числом' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_available_slots',
        description:
          'Слоты конкретного врача (doctorId уже известен). Если только специальность — используй find_doctors_and_slots. ' +
          'doctorId/clinicId бери ТОЛЬКО из find_doctors. ' +
          'Возвращает date, dateLabel ("Сегодня"/"Завтра"/"Послезавтра"/"Вторник, 26 мая"), clinicId, clinicName, times, dtSlots (нужен для startTime/endTime в book_appointment). ' +
          'Режимы: nearest (по умолч., ≤5 ближайших) / day (ВСЕ слоты конкретной даты — используй когда пациент назвал конкретное время или хочет видеть весь день) / week.',
        parameters: {
          type: 'object',
          properties: {
            doctorId:   { type: 'number', description: 'ID врача из find_doctors' },
            clinicId:   { type: 'number', description: 'ID клиники из find_doctors' },
            mode: {
              type: 'string',
              enum: ['nearest', 'day', 'week'],
              description: 'nearest / day / week',
            },
            targetDate: { type: 'string', description: 'YYYY-MM-DD (для day/week)' },
            dayOfWeek:  { type: 'string', description: '"понедельник"…/"завтра"/"послезавтра"' },
            nextWeek:   { type: 'boolean', description: 'true для "следующей недели"' },
          },
          required: ['doctorId', 'clinicId'],
        },
      },
      {
        name: 'book_appointment',
        description:
          'Создаёт запись. Вызывай ТОЛЬКО после явного "да"/"подтверждаю". ' +
          'Перед вызовом покажи сводку (врач, дата, время, клиника) и спроси "Подтверждаете запись?". ' +
          'Стоимость в сводке НЕ упоминай, если пациент о цене не спрашивал. ' +
          'startTime/endTime — из dtSlots. specialityId и price — из find_doctors_and_slots (для приёма врача) ИЛИ find_services (для процедуры; там price = цена услуги). ' +
          (hasPatient
            ? 'Данные пациента известны — не спрашивай и не передавай ФИО/телефон/дату рождения.'
            : 'Гостевой режим (данных пациента нет): (1) спроси одним сообщением фамилию, имя, отчество, телефон, дату рождения; ' +
              '(2) дождись ответа; (3) покажи сводку и спроси подтверждение; (4) только после "да" вызывай с РЕАЛЬНЫМИ значениями. ' +
              'Запрещено передавать плейсхолдеры ({FIRST_NAME}, <PHONE> и т.п.) или пустые строки. ' +
              'В сводке "Врач" — из find_doctors, НЕ имя пациента.'),
        parameters: {
          type: 'object',
          properties: {
            doctorId:     { type: 'number', description: 'ID врача' },
            clinicId:     { type: 'number', description: 'ID клиники' },
            specialityId: { type: 'number', description: 'ID специальности из find_doctors_and_slots / find_services' },
            startTime:    { type: 'string', description: 'dtSlots.dt_start, "YYYY-MM-DD HH:MM"' },
            endTime:      { type: 'string', description: 'dtSlots.dt_end, "YYYY-MM-DD HH:MM"' },
            price:        { type: 'number', description: 'Цена из find_doctors_and_slots (приём) или find_services (процедура)' },
            firstName:    { type: 'string', description: 'Имя пациента' },
            lastName:     { type: 'string', description: 'Фамилия пациента' },
            secondName:   { type: 'string', description: 'Отчество (или пустая строка)' },
            phone:        { type: 'string', description: 'Телефон в любом формате (сервер нормализует)' },
            birthday:     { type: 'string', description: 'Дата рождения в любом формате ("1 января 1983", "01.01.1983")' },
            comment:      { type: 'string', description: 'Комментарий, опционально' },
          },
          required: hasPatient
            ? ['doctorId', 'clinicId', 'specialityId', 'startTime', 'endTime', 'price']
            : ['doctorId', 'clinicId', 'specialityId', 'startTime', 'endTime', 'price', 'firstName', 'lastName', 'phone', 'birthday'],
        },
      },
    ];

    // Инструменты, требующие идентификации пациента — добавляем только если пациент авторизован.
    if (hasPatient) {
      tools.push(
        {
          name: 'cancel_appointment',
          description: 'Отмена записи. Вызывай только после подтверждения. uuid — из get_patient_appointments.',
          parameters: {
            type: 'object',
            properties: {
              uuid: { type: 'string', description: 'UUID записи' },
            },
            required: ['uuid'],
          },
        },
        {
          name: 'reschedule_appointment',
          description:
            'Атомарный перенос: отменяет старую запись и создаёт новую за один вызов. ' +
            'Используй для любого «перенеси/перепиши на другую дату/время». Вызывай ТОЛЬКО после явного "да"/"подтверждаю". ' +
            'oldUuid — UUID старой записи (из истории сессии). Остальные параметры — для новой записи из find_doctors_and_slots/find_services.',
          parameters: {
            type: 'object',
            properties: {
              oldUuid:      { type: 'string', description: 'UUID старой записи' },
              doctorId:     { type: 'number', description: 'ID врача новой записи' },
              clinicId:     { type: 'number', description: 'ID клиники' },
              specialityId: { type: 'number', description: 'ID специальности' },
              startTime:    { type: 'string', description: 'dtSlot.dt_start новой записи' },
              endTime:      { type: 'string', description: 'dtSlot.dt_end' },
              price:        { type: 'number', description: 'Цена' },
            },
            required: ['oldUuid', 'doctorId', 'clinicId', 'specialityId', 'startTime', 'endTime', 'price'],
          },
        },
        {
          name: 'get_patient_appointments',
          description:
            'Записи пациента по телефону. Вызывай для "мои записи", "когда я записан". ' +
            'Если телефон неизвестен — спроси.',
          parameters: {
            type: 'object',
            properties: {
              phone: { type: 'string', description: 'Телефон, 79XXXXXXXXX' },
            },
            required: ['phone'],
          },
        },
      );
    }

    return tools;
  }

  // ── Маршрутизатор tool-вызовов ────────────────────────────────────────────────

  async executeTool(
    name: string,
    args: Record<string, any>,
    clientId?: number,
    apiKey?: string | null,
    lpuGroupId?: number,
    townId?: number,
    districtId?: number,
    patient?: PatientData,
  ): Promise<unknown> {
    if (!apiKey) {
      this.logger.warn(`MedFlex tool '${name}' called without API key`);
      return { error: 'Ключ интеграции MedFlex не настроен. Обратитесь к администратору.' };
    }
    if (!lpuGroupId) {
      this.logger.warn(`MedFlex tool '${name}' called without lpuGroupId`);
      return { error: 'Идентификатор сети клиник не задан.' };
    }

    const client = new MedflexClient(apiKey);

    // В гостевом режиме блокируем операции, требующие идентификатор пациента (телефон).
    // cancel_appointment по uuid допускается — он используется внутри сервиса при разрешении конфликтов.
    if (!patient && (name === 'get_patient_appointments' || name === 'find_patient_appointment')) {
      return { error: 'Для работы с существующими записями нужно войти в личный кабинет на сайте клиники.' };
    }

    try {
      switch (name) {
        case 'get_clinics':
          return this.getClinics(client, lpuGroupId, townId);

        case 'find_doctors':
          return this.findDoctors(client, args.speciality, lpuGroupId, args.clinicId, townId);

        case 'find_services': {
          // dayOfWeek/date — фильтр по конкретной дате. Аналогично find_doctors_and_slots,
          // dayOfWeek приоритетнее (резолвер надёжнее, чем LLM-арифметика).
          let svcTargetDate: string | undefined = args.date;
          if (args.dayOfWeek) {
            svcTargetDate = resolveRelativeOrWeekday(args.dayOfWeek, args.nextWeek ? 1 : 0) ?? svcTargetDate;
          }
          return this.findServices(client, {
            query: args.query,
            targetDate: svcTargetDate,
            lpuGroupId,
            clinicId: args.clinicId,
            townId,
          });
        }

        case 'get_available_slots': {
          // dayOfWeek имеет приоритет над targetDate: если LLM ошиблась с YYYY-MM-DD,
          // серверный резолвер пересчитает дату корректно от слова дня.
          let targetDate: string | undefined = args.targetDate;
          if (args.dayOfWeek) {
            targetDate = resolveRelativeOrWeekday(args.dayOfWeek, args.nextWeek ? 1 : 0) ?? targetDate;
          }
          return this.getAvailableSlots(client, {
            doctorId: args.doctorId,
            clinicId: args.clinicId,
            lpuGroupId,
            // Если есть конкретная дата — по умолчанию режим 'day' (все слоты).
            // mode='nearest' имеет смысл только без targetDate.
            mode: args.mode ?? (targetDate ? 'day' : 'nearest'),
            targetDate,
            townId,
          });
        }

        case 'find_doctors_and_slots': {
          // dayOfWeek имеет приоритет над date: если LLM ошиблась с YYYY-MM-DD,
          // серверный резолвер пересчитает дату корректно от слова дня.
          let targetDate: string | undefined = args.date;
          if (args.dayOfWeek) {
            targetDate = resolveRelativeOrWeekday(args.dayOfWeek, args.nextWeek ? 1 : 0) ?? targetDate;
          }
          return this.findDoctorsAndSlots(client, {
            speciality: args.speciality,
            clinicId: args.clinicId,
            lpuGroupId,
            mode: args.mode ?? (targetDate ? 'day' : 'nearest'),
            targetDate,
            townId,
          });
        }

        case 'book_appointment': {
          // Данные пациента — единственный источник истины session.patient.
          // ПЕРЕЗАПИСЫВАЕМ (не autofill), даже если LLM что-то передала: при повторной
          // записи LLM иногда сочиняет ФИО/телефон. Server — source of truth.
          const bookArgs = { ...args };
          if (patient) {
            bookArgs.firstName  = patient.firstName;
            bookArgs.lastName   = patient.lastName;
            bookArgs.secondName = patient.secondName;
            bookArgs.phone      = patient.phone;
            bookArgs.birthday   = patient.birthday;
          }
          // Гостевой режим: проверяем, что LLM реально получил данные от пациента,
          // а не подставил плейсхолдеры (`{ИМЯ}`, `<PHONE>`) или лейбл-слова («Имя», «Телефон»).
          // Дублирует ранний guard в chat.service.ts как defense-in-depth.
          if (!patient) {
            const missing: string[] = [];
            if (isPlaceholderValue(bookArgs.firstName)) missing.push('имя');
            if (isPlaceholderValue(bookArgs.lastName))  missing.push('фамилию');
            if (isMissingPhone(bookArgs.phone))         missing.push('телефон');
            if (isMissingBirthday(bookArgs.birthday))   missing.push('дату рождения');
            if (missing.length > 0) {
              return {
                success: false,
                reason: 'patient_data_required',
                message:
                  `Данные пациента не получены (${missing.join(', ')}). ` +
                  `НЕ вызывай book_appointment повторно с плейсхолдерами или пустыми значениями. ` +
                  `Сначала спроси у пользователя одним сообщением: фамилию, имя, отчество, телефон и дату рождения. ` +
                  `Только после ответа пользователя вызови book_appointment снова, подставив реальные значения.`,
              };
            }
          }
          try {
            return await this.bookAppointment(client, bookArgs as any);
          } catch (bookErr: any) {
            const bookErrMsg = String(bookErr.message ?? bookErr);
            if (bookErrMsg.includes('409')) {
              // Ищем конфликтующую запись по телефону и дате через history API
              const existing = await this.findConflictingAppointment(
                client,
                bookArgs.phone as string | undefined,
                bookArgs.startTime as string,
              );
              return {
                success: false,
                conflict: true,
                existingAppointment: existing,
                pendingBookingArgs: bookArgs,
              };
            }
            throw bookErr;
          }
        }

        case 'cancel_appointment':
          if (!args.uuid) return { error: 'UUID записи не указан.' };
          return this.cancelAppointment(client, args.uuid);

        case 'reschedule_appointment': {
          // Атомарный перенос: cancel(old) → book(new).
          if (!args.oldUuid) return { success: false, message: 'oldUuid обязателен' };
          if (!patient) return { success: false, message: 'Данные пациента в сессии отсутствуют — нельзя перенести запись без них.' };
          try {
            await this.cancelAppointment(client, String(args.oldUuid));
          } catch (e: any) {
            return { success: false, message: `Не удалось отменить старую запись: ${e?.message ?? e}` };
          }
          // После отмены — создаём новую с данными пациента из сессии.
          const bookArgs = {
            doctorId: args.doctorId,
            clinicId: args.clinicId,
            specialityId: args.specialityId,
            startTime: args.startTime,
            endTime: args.endTime,
            price: args.price,
            firstName: patient.firstName,
            lastName: patient.lastName,
            secondName: patient.secondName ?? '',
            phone: patient.phone,
            birthday: patient.birthday,
          };
          try {
            const bookResult = await this.bookAppointment(client, bookArgs as any);
            return { ...bookResult, oldCanceled: true };
          } catch (e: any) {
            return {
              success: false,
              message: 'Старая запись отменена, но создать новую не удалось. Попробуйте записаться снова.',
              oldCanceled: true,
              bookError: String(e?.message ?? e),
            };
          }
        }

        case 'get_patient_appointments': {
          const phone = args.phone ?? patient?.phone;
          if (!phone) return { error: 'Номер телефона не указан. Пожалуйста, попроси пациента назвать телефон.' };
          return this.getPatientAppointments(client, phone, lpuGroupId);
        }

        case 'find_patient_appointment': {
          const phone = args.phone ?? patient?.phone;
          if (!phone) return { error: 'Номер телефона не указан.' };
          return this.getPatientAppointments(client, phone, lpuGroupId);
        }

        default:
          return { error: `Инструмент '${name}' не поддерживается в MedFlex.` };
      }
    } catch (err: any) {
      this.logger.error(`MedFlex tool ${name} error: ${String(err)}`);
      // Разбираем коды ошибок MedFlex (409 обрабатывается внутри book_appointment case)
      const msg = String(err.message ?? err);
      if (msg.includes('423')) return { error: 'Выбранный слот уже занят. Пожалуйста, выберите другое время.' };
      if (msg.includes('400')) return { error: 'Запись не удалась. Возможно, слот недоступен. Уточните данные и попробуйте снова.' };
      if (msg.includes('401')) return { error: 'Ошибка авторизации MedFlex. Обратитесь к администратору.' };
      if (msg.includes('429')) return { error: 'Превышен лимит запросов. Пожалуйста, подождите минуту и повторите.' };
      return { error: `Ошибка при выполнении ${name}. Пожалуйста, уточни данные и попробуй снова.` };
    }
  }

  /**
   * Ищет активную запись пациента на дату конфликтующего слота через API истории.
   * Используется при обработке 409 от book_appointment.
   */
  private async findConflictingAppointment(
    client: MedflexClient,
    phone: string | undefined,
    startTime: string,
  ): Promise<{ uuid: string; description: string } | null> {
    if (!phone) return null;
    const normalizedPhone = normalizeRuPhone(phone);
    if (!normalizedPhone) return null;
    const date = startTime.slice(0, 10); // YYYY-MM-DD
    try {
      const history = await client.getAppointmentHistory({
        mobilePhone: normalizedPhone,
        dateStart: date,
        dateEnd: date,
        size: 10,
      });
      const active = history.data.filter((a) => !a.canceled);
      if (active.length === 0) return null;
      const a = active[0];
      return {
        uuid: a.uuid,
        description: `${a.date} в ${a.time_start.slice(0, 5)} у ${a.doctor.fio} в ${a.lpu.name}`,
      };
    } catch (err) {
      this.logger.warn(`Could not fetch conflicting appointment: ${String(err)}`);
      return null;
    }
  }

  // ── Кэш специальностей ────────────────────────────────────────────────────────

  private async getCachedSpecialities(client: MedflexClient, apiKey: string): Promise<MfSpeciality[]> {
    const cached = this.specialityCache.get(apiKey);
    if (cached && Date.now() - cached.fetchedAt < SPECIALITY_TTL_MS) {
      return cached.data;
    }
    this.logger.log('Fetching MedFlex specialities...');
    const data = await client.getSpecialities();
    this.specialityCache.set(apiKey, { data, fetchedAt: Date.now() });
    this.logger.log(`MedFlex specialities cached: ${data.length}`);
    return data;
  }

  /**
   * Нечёткий поиск специальностей по имени.
   * Ищет вхождение строки запроса в название (регистронезависимо).
   */
  private async resolveSpecialities(
    query: string,
    client: MedflexClient,
    apiKey: string,
  ): Promise<MfSpeciality[]> {
    const all = await this.getCachedSpecialities(client, apiKey);
    const q = query.toLowerCase().trim();
    // Точное вхождение
    const matches = all.filter((s) => s.name.toLowerCase().includes(q));
    if (matches.length > 0) return matches;
    // Фаллбэк: поиск по первому слову запроса
    const firstWord = q.split(' ')[0];
    return all.filter((s) => s.name.toLowerCase().includes(firstWord));
  }

  // ── Кэш клиник ────────────────────────────────────────────────────────────────

  private async getCachedLpus(client: MedflexClient, lpuGroupId: number, townId?: number): Promise<MfLpu[]> {
    const cached = this.lpuCache.get(lpuGroupId);
    if (cached && Date.now() - cached.fetchedAt < LPU_TTL_MS) {
      return cached.lpus;
    }
    this.logger.log(`Fetching MedFlex LPUs for group ${lpuGroupId}...`);
    const lpus = await client.getAllLpus(lpuGroupId, townId);
    this.lpuCache.set(lpuGroupId, { lpus, fetchedAt: Date.now() });
    this.logger.log(`MedFlex LPUs cached for group ${lpuGroupId}: ${lpus.length}`);
    return lpus;
  }

  // ── Методы ───────────────────────────────────────────────────────────────────

  async getClinics(client: MedflexClient, lpuGroupId: number, townId?: number): Promise<ClinicInfo[]> {
    const lpus = await this.getCachedLpus(client, lpuGroupId, townId);
    return lpus
      .filter((l) => l.is_visible && l.direct_appointment_is_supported)
      .map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address,
        phone: l.phone ?? null,
      }));
  }

  async findDoctors(
    client: MedflexClient,
    speciality: string,
    lpuGroupId: number,
    clinicId?: number,
    townId?: number,
  ): Promise<Array<DoctorInfo & { specialityId: number | null }>> {
    const apiKey = (client as any).apiKey as string;

    // Резолвим специальность
    const matchedSpecs = await this.resolveSpecialities(speciality, client, apiKey);
    const specialityIds = matchedSpecs.map((s) => s.id);

    // Получаем ID клиник группы (если clinicId не задан — ищем во всех)
    let lpuIds: number[];
    if (clinicId) {
      lpuIds = [clinicId];
    } else {
      const lpus = await this.getCachedLpus(client, lpuGroupId, townId);
      lpuIds = lpus.filter((l) => l.direct_appointment_is_supported).map((l) => l.id);
    }

    if (lpuIds.length === 0) return [];

    // Карта lpu_id → название
    const lpus = await this.getCachedLpus(client, lpuGroupId, townId);
    const lpuNameMap = new Map(lpus.map((l) => [l.id, l.name]));

    // Если специальность сматчилась — фильтруем по specialityIds.
    // Если нет — пробуем поиск по фамилии (не дёргаем «всех врачей», иначе вернётся
    // нерелевантный список и LLM начнёт галлюцинировать «УЗИ сердца у терапевта»).
    let doctors: MfDoctor[];
    if (specialityIds.length > 0) {
      const page = await client.getDoctors({
        lpuIds: lpuIds.join(','),
        specialityIds: specialityIds.join(','),
        size: 50,
      });
      doctors = page.data;
    } else {
      // Fallback: поиск по efio (фамилия/имя врача).
      const allPage = await client.getDoctors({ lpuIds: lpuIds.join(','), size: 50 });
      const q = speciality.toLowerCase();
      doctors = allPage.data.filter((d) => d.efio.toLowerCase().includes(q));
    }

    return doctors.map((d) => {
      // Находим matched speciality (первая из совпавших)
      const matchedSpecId = d.specialities.find((sid) => specialityIds.includes(sid)) ?? d.specialities[0] ?? null;
      const matchedSpecName = matchedSpecId
        ? (matchedSpecs.find((s) => s.id === matchedSpecId)?.name ?? `Специальность #${matchedSpecId}`)
        : speciality;

      // Цена для matched специальности в каждой клинике
      const priceForSpec = d.prices?.find((p) => p.speciality_id === matchedSpecId);
      const price = priceForSpec?.price ?? null;

      // Клиники врача (только из нашей группы)
      const docClinicIds = d.lpus.filter((id) => lpuIds.includes(id));

      return {
        id: d.id,
        name: d.efio,
        speciality: matchedSpecName,
        specialityId: matchedSpecId,
        price: typeof price === 'number' ? price : null,
        clinics: docClinicIds.map((id) => ({ id, name: lpuNameMap.get(id) ?? `Клиника #${id}` })),
      };
    });
  }

  async getAvailableSlots(
    client: MedflexClient,
    params: {
      doctorId: number;
      clinicId: number;
      lpuGroupId: number;
      mode: SlotMode;
      targetDate?: string;
      townId?: number;
    },
  ): Promise<Array<SlotGroup & { dtSlots: Array<{ dt_start: string; dt_end: string }> }>> {
    const { doctorId, clinicId, mode, targetDate } = params;

    const now = new Date();
    const fromDate = targetDate ?? toDateStr(now);
    const days = mode === 'week' ? 14 : 14;

    // Конец периода для запроса истории
    const toDateObj = new Date(fromDate + 'T00:00:00');
    toDateObj.setDate(toDateObj.getDate() + days);
    const toDate = toDateStr(toDateObj);

    // Запрашиваем расписание и историю параллельно
    const [schedPage, histPage] = await Promise.all([
      client.getScheduleByLpu({
        lpuIds: String(clinicId),
        dateStart: fromDate,
        days,
      }),
      // История записей врача в этой клинике за период.
      // Используется для точного вычитания занятых слотов, т.к. расписание
      // может не отражать актуальный статус (кэш на стороне МИС).
      client.getAppointmentHistory({
        lpuId: clinicId,
        doctorId,
        dateStart: fromDate,
        dateEnd: toDate,
        size: 500,
      }).catch(() => ({ data: [] as any[], count: 0, num_pages: 1, links: { next: null, previous: null } })),
    ]);

    // Набор занятых слотов: "YYYY-MM-DD HH:MM"
    const bookedKeys = new Set<string>(
      histPage.data
        .filter((h) => !h.canceled)
        .map((h) => `${h.date} ${h.time_start.slice(0, 5)}`),
    );

    // Объединяем все страницы (для простоты берём первую — обычно хватает)
    const allLpuSchedules = schedPage.data;

    // Ищем клинику
    const lpus = await this.getCachedLpus(client, params.lpuGroupId, params.townId);
    const clinicName = lpus.find((l) => l.id === clinicId)?.name ?? `Клиника #${clinicId}`;

    // Ищем расписание конкретного врача
    const doctorSchedules = allLpuSchedules.flatMap((lpuSched) => {
      const doc = lpuSched.schedule.find((s) => s.doctor_id === doctorId);
      if (!doc) return [];
      return doc.cells.map((cell) => ({ ...cell, lpu_id: lpuSched.lpu_id }));
    });

    if (doctorSchedules.length === 0) return [];

    // Фильтрация прошедших и уже занятых слотов
    const futureCells = doctorSchedules.filter((cell) => {
      const dt = parseMfDateTime(cell.dt_start);
      if (dt <= now) return false;
      // Вычитаем слоты из истории записей (двойная защита помимо schedule API)
      return !bookedKeys.has(cell.dt_start.slice(0, 16));
    });

    // Группируем по дате
    const groups = new Map<string, { times: string[]; dtSlots: { dt_start: string; dt_end: string }[] }>();
    for (const cell of futureCells) {
      const date = cell.dt_start.slice(0, 10); // YYYY-MM-DD
      const time = cell.dt_start.slice(11, 16); // HH:MM
      if (!groups.has(date)) {
        groups.set(date, { times: [], dtSlots: [] });
      }
      groups.get(date)!.times.push(time);
      groups.get(date)!.dtSlots.push({ dt_start: cell.dt_start, dt_end: cell.dt_end });
    }

    const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

    const result = sorted.map(([date, { times, dtSlots }]) => {
      return {
        date,
        dateLabel: formatRuDateLabel(date),
        clinicId,
        clinicName,
        times: mode === 'nearest' ? times.slice(0, 5) : times,
        dtSlots: mode === 'nearest' ? dtSlots.slice(0, 5) : dtSlots,
      };
    });

    if (mode === 'nearest') {
      return result.length > 0 ? [result[0]] : [];
    }
    if (mode === 'day' && targetDate) {
      return result.filter((r) => r.date === targetDate);
    }
    return result;
  }

  async findDoctorsAndSlots(
    client: MedflexClient,
    params: {
      speciality: string;
      clinicId?: number;
      lpuGroupId: number;
      mode: SlotMode;
      targetDate?: string;
      townId?: number;
    },
  ): Promise<unknown[]> {
    const doctors = await this.findDoctors(client, params.speciality, params.lpuGroupId, params.clinicId, params.townId);
    if (doctors.length === 0) {
      // Fallback: пациент мог назвать услугу как «специальность» («чистка лица»,
      // «УЗИ сердца», «ботокс»). Пробуем find_services с тем же query —
      // LLM получит совместимый по форме результат с doctorId/doctorName/slot.
      const svc = await this.findServices(client, {
        query: params.speciality,
        lpuGroupId: params.lpuGroupId,
        clinicId: params.clinicId,
        townId: params.townId,
        targetDate: params.targetDate,
      });
      if (svc.length > 0) return svc;
      return [];
    }

    const results = await Promise.all(
      doctors.map(async (doc) => {
        const clinicIds = doc.clinics.map((c) => c.id);
        for (const cId of clinicIds) {
          const slots = await this.getAvailableSlots(client, {
            doctorId: doc.id,
            clinicId: cId,
            lpuGroupId: params.lpuGroupId,
            mode: params.mode,
            targetDate: params.targetDate,
            townId: params.townId,
          });
          if (slots.length > 0 && slots[0].times.length > 0) {
            return {
              doctorId: doc.id,
              doctorName: doc.name,
              speciality: doc.speciality,
              specialityId: doc.specialityId,
              price: doc.price,
              isAvailable: true,
              slot: { date: slots[0].date, dateLabel: formatRuDateLabel(slots[0].date), time: slots[0].times[0], clinicId: cId, clinicName: slots[0].clinicName },
              // allSlots: clinicId/clinicName/dayLabel совпадают с slot.* (один cId, mode='day' = одна дата) — не дублируем для экономии токенов.
              allSlots: params.mode === 'day'
                ? slots.flatMap((sg) => sg.times.map((t, i) => ({ date: sg.date, time: t, dtSlot: sg.dtSlots[i] })))
                : undefined,
            };
          }
        }
        return {
          doctorId: doc.id,
          doctorName: doc.name,
          speciality: doc.speciality,
          specialityId: doc.specialityId,
          price: doc.price,
          isAvailable: false,
          slot: null,
        };
      }),
    );

    return results;
  }

  /**
   * Поиск медицинской УСЛУГИ (процедуры/исследования) по названию + ближайшие слоты врачей,
   * которые её выполняют. Используется для запросов вида "УЗИ сердца", "пилинг", "ботокс".
   *
   * Flow: /services/prices/?lpu_id=… (per LPU) → match по name → for each doctor in service.doctor_ids
   *   → /models/doctor/?doctor_ids=… → /schedule/ → ближайший слот.
   *
   * Бронирование идёт по специальности врача (book_appointment.specialityId), но цена
   * в book_appointment.price = service.price, а не приём врача.
   */
  async findServices(
    client: MedflexClient,
    params: {
      query: string;
      lpuGroupId: number;
      clinicId?: number;
      townId?: number;
      /** Если задан — слоты фильтруются на этот день; иначе берём ближайший. */
      targetDate?: string;
    },
  ): Promise<unknown[]> {
    const apiKey = (client as any).apiKey as string;

    // Список клиник для поиска
    let lpuIds: number[];
    if (params.clinicId) {
      lpuIds = [params.clinicId];
    } else {
      const lpus = await this.getCachedLpus(client, params.lpuGroupId, params.townId);
      lpuIds = lpus.filter((l) => l.direct_appointment_is_supported).map((l) => l.id);
    }
    if (lpuIds.length === 0) return [];

    // /services/prices/ per-lpu (lpu_id обязателен по спеке) → собираем + фильтруем по name.
    const q = params.query.toLowerCase().trim();
    const matched: Array<{ service: MfService; lpuId: number }> = [];
    for (const lpuId of lpuIds) {
      const list = await client.getServicePrices({ lpuId });
      for (const s of list) {
        if (s.name.toLowerCase().includes(q)) {
          matched.push({ service: s, lpuId });
        }
      }
    }
    if (matched.length === 0) return [];

    // Загружаем всех нужных врачей одним вызовом
    const allDoctorIds = [...new Set(matched.flatMap((m) => m.service.doctor_ids))];
    if (allDoctorIds.length === 0) return matched.map(({ service, lpuId }) => ({
      serviceId: service.id,
      serviceName: service.name,
      duration: service.duration,
      price: service.price,
      doctorId: null,
      doctorName: null,
      speciality: '',
      specialityId: null,
      isAvailable: false,
      slot: null,
      clinicId: lpuId,
    }));

    const docPage = await client.getDoctors({
      lpuIds: lpuIds.join(','),
      doctorIds: allDoctorIds.join(','),
      size: 100,
    });
    const docMap = new Map(docPage.data.map((d) => [d.id, d]));

    // Карта lpu_id → название и кэш специальностей для имени speciality.
    const lpus = await this.getCachedLpus(client, params.lpuGroupId, params.townId);
    const lpuNameMap = new Map(lpus.map((l) => [l.id, l.name]));
    const allSpecs = await this.getCachedSpecialities(client, apiKey);
    const specMap = new Map(allSpecs.map((s) => [s.id, s.name]));

    // Для каждой пары (service × doctor) — ближайший слот.
    const result: unknown[] = [];
    for (const { service, lpuId } of matched) {
      const lpuName = lpuNameMap.get(lpuId) ?? `Клиника #${lpuId}`;
      for (const docId of service.doctor_ids) {
        const doc = docMap.get(docId);
        if (!doc || !doc.lpus.includes(lpuId)) continue;

        const specialityId = doc.specialities[0] ?? null;
        const specialityName = specialityId
          ? (specMap.get(specialityId) ?? `Специальность #${specialityId}`)
          : '';

        const slots = await this.getAvailableSlots(client, {
          doctorId: docId,
          clinicId: lpuId,
          lpuGroupId: params.lpuGroupId,
          // Если задан targetDate — берём весь день; иначе ближайший слот.
          mode: params.targetDate ? 'day' : 'nearest',
          targetDate: params.targetDate,
          townId: params.townId,
        });

        const baseInfo = {
          serviceId: service.id,
          serviceName: service.name,
          duration: service.duration,
          price: service.price,
          doctorId: docId,
          doctorName: doc.efio,
          speciality: specialityName,
          specialityId,
        };

        if (slots.length > 0 && slots[0].times.length > 0) {
          result.push({
            ...baseInfo,
            isAvailable: true,
            slot: {
              date: slots[0].date,
              dateLabel: formatRuDateLabel(slots[0].date),
              time: slots[0].times[0],
              clinicId: lpuId,
              clinicName: lpuName,
              dtSlot: slots[0].dtSlots[0],
            },
          });
        } else {
          result.push({ ...baseInfo, isAvailable: false, slot: null, clinicId: lpuId, clinicName: lpuName });
        }
      }
    }

    return result;
  }

  async bookAppointment(
    client: MedflexClient,
    args: {
      doctorId: number;
      clinicId: number;
      specialityId: number;
      startTime: string;
      endTime: string;
      price: number;
      firstName: string;
      lastName: string;
      secondName?: string;
      phone: string;
      birthday: string;
      comment?: string;
    },
  ): Promise<BookingResult> {
    const { doctorId, clinicId, specialityId, startTime, endTime, price } = args;

    // Проверяем что слот в будущем
    const start = parseMfDateTime(startTime);
    if (start <= new Date()) {
      return { success: false, message: 'Нельзя записаться на прошедшее время. Пожалуйста, выберите будущий слот.' };
    }

    // Нормализуем телефон к 79XXXXXXXXX (поддержка +7, 8, 7, без кода страны)
    const phone = normalizeRuPhone(args.phone);
    if (!phone) {
      return { success: false, message: 'Неверный формат телефона. Укажите мобильный номер из 10 или 11 цифр.' };
    }

    // Нормализуем дату рождения (принимаем любой формат: "1 января 1983", "01.01.1983", "1983-01-01")
    const birthday = parseFlexibleDate(args.birthday);
    if (!birthday) {
      return { success: false, message: 'Не удалось распознать дату рождения. Попросите пациента уточнить дату.' };
    }

    // Форматируем даты в ISO для API
    const dtStart = mfDateTimeToIso(startTime);
    const dtEnd = mfDateTimeToIso(endTime);

    const response = await client.createAppointment({
      doctor: { id: doctorId, lpu_id: clinicId, speciality_id: specialityId },
      appointment: {
        dt_start: dtStart,
        dt_end: dtEnd,
        price,
        comment: args.comment,
      },
      client: {
        first_name: args.firstName,
        last_name: args.lastName,
        second_name: args.secondName ?? '',
        mobile_phone: phone,
        birthday,
      },
    });

    this.logger.log(`MedFlex booking created: ${response.claim_id}`);

    const dateStr = formatRuDateTime(start);
    return {
      success: true,
      appointmentId: undefined, // MedFlex uses UUID, not integer
      uuid: response.claim_id,
      message: `Запись подтверждена! ${dateStr}.`,
    };
  }

  async cancelAppointment(client: MedflexClient, uuid: string): Promise<{ success: boolean; message: string }> {
    await client.cancelAppointment(uuid);
    this.logger.log(`MedFlex appointment cancelled: ${uuid}`);
    return { success: true, message: 'Запись успешно отменена.' };
  }

  async getPatientAppointments(
    client: MedflexClient,
    phone: string,
    lpuGroupId: number,
  ): Promise<Array<PatientAppointmentItem & { uuid: string; canceled: boolean; price: number }>> {
    const normalizedPhone = normalizeRuPhone(phone);
    if (!normalizedPhone) {
      throw new Error('Неверный формат телефона. Укажите мобильный номер из 10 или 11 цифр.');
    }

    const history = await client.getAppointmentHistory({
      mobilePhone: normalizedPhone,
      size: 20,
    });

    const now = new Date();

    return history.data
      .filter((a) => {
        // Исключаем записи, время которых уже прошло
        const dt = new Date(`${a.date}T${a.time_start.slice(0, 5)}:00`);
        return dt > now;
      })
      .map((a) => ({
        uuid: a.uuid,
        type: 'doctor' as const,
        date: a.date,
        time: a.time_start.slice(0, 5),
        clinicName: a.lpu.name,
        doctorName: a.doctor.fio,
        speciality: a.doctor.speciality_name,
        canceled: a.canceled,
        price: a.price,
      }));
  }
}

// ── Утилиты ───────────────────────────────────────────────────────────────────

/**
 * Парсит строку даты-времени MedFlex в объект Date.
 * Поддерживает: "YYYY-MM-DD HH:MM", "YYYY-MM-DD HH:MM:SS",
 *               "YYYY-MM-DDTHH:MM", "YYYY-MM-DDTHH:MM:SS[Z|±HH:MM]"
 */
function parseMfDateTime(s: string): Date {
  return new Date(mfDateTimeToIso(s));
}

/**
 * Нормализует строку даты-времени в ISO 8601 для API MedFlex.
 * Вход: любой из вариантов "YYYY-MM-DD HH:MM[(:SS)]" или "YYYY-MM-DDTHH:MM[(:SS)(Z|±offset)]"
 * Выход: "YYYY-MM-DDTHH:MM:SS" (без суффикса зоны, если входная строка его не содержит)
 */
function mfDateTimeToIso(s: string): string {
  // Нормализуем пробел-разделитель → T
  const norm = s.trim().replace(' ', 'T');
  // Уже корректный ISO с секундами (с зоной или без): возвращаем как есть
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(norm)) return norm;
  // Есть T, но нет секунд: "...THH:MM" → добавляем ":00"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(norm)) return norm + ':00';
  // Дата без времени: добавляем полночь
  if (/^\d{4}-\d{2}-\d{2}$/.test(norm)) return norm + 'T00:00:00';
  // Fallback: возвращаем как есть и пусть API разберётся
  return norm;
}

function formatRuDateTime(d: Date): string {
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]}, ${h}:${m}`;
}

/**
 * Резолвит относительные даты ("завтра", "послезавтра") и дни недели в YYYY-MM-DD.
 * weekOffset=1 сдвигает на следующую неделю (для фразы "следующей недели").
 */
function resolveRelativeOrWeekday(dayName: string, weekOffset = 0): string | null {
  // Принимаем любую морфологическую форму, приводим к канонической.
  const s = normalizeDayWord(dayName);
  if (!s) return null;

  // Относительные даты
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (s === 'завтра') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1 + weekOffset * 7);
    return toDateStr(d);
  }
  if (s === 'послезавтра') {
    const d = new Date(today);
    d.setDate(d.getDate() + 2 + weekOffset * 7);
    return toDateStr(d);
  }
  if (s === 'сегодня') {
    return toDateStr(today);
  }

  // Дни недели — после normalizeDayWord уже в каноническом виде.
  // nextWeekdayDate корректно обрабатывает weekOffset (без двойного сдвига).
  return nextWeekdayDate(s, weekOffset);
}
