/**
 * Типы данных API Инфоклиника.RU
 * Документация: https://docs.infoclinica.ru/icru/integration/leads
 *
 * Единый endpoint: POST https://api.infoclinica.ru/api/xml
 * Авторизация: client SSL certificate (.pfx)
 * Заголовок X-Forwarded-Host: <clinic>.infoclinica.ru (идентифицирует филиал)
 * Content-Type: application/xml
 */

// ── Конфигурация подключения ────────────────────────────────────────────────

export interface InfclinicaConfig {
  /** Базовый URL API, например https://api.infoclinica.ru/api/xml */
  apiUrl: string;
  /** Домен клиники на портале, например demo.infoclinica.ru */
  host: string;
  /** Путь к SSL-сертификату (.pfx) */
  certPath?: string;
  /** Пароль к сертификату */
  certPassword?: string;
  /** Использовать mock-данные вместо реального API */
  useMock: boolean;
}

// ── Справочники ─────────────────────────────────────────────────────────────

/** Филиал (клиника) — ответ GET_FILIAL_LIST */
export interface IcFilial {
  /** Идентификатор филиала */
  FILIAL: number;
  /** Название филиала */
  FNAME: string;
  /** Адрес */
  FADDRESS?: string;
  /** Телефон */
  FPHONE?: string;
  /** Идентификатор подразделения (CASHID). Один филиал может иметь несколько подразделений */
  CASHID?: number;
}

/** Специализация (отделение) — ответ GET_DEPARTMENT_LIST */
export interface IcDepartment {
  /** Идентификатор отделения */
  DEPNUM: number;
  /** Название отделения */
  DEPNAME: string;
}

/** Врач — ответ GET_DOCTOR_LIST */
export interface IcDoctor {
  /** Идентификатор врача в МИС */
  DCODE: number;
  /** ФИО врача */
  DNAME: string;
  /** Идентификатор отделения */
  DEPNUM: number;
  /** Название отделения */
  DEPNAME: string;
  /** Идентификатор филиала */
  FILIAL: number;
  /** Название филиала */
  FNAME: string;
  /** Внешний идентификатор сотрудника */
  EXTPCODE?: string;
  /** Стоимость приёма */
  PRICE?: number;
}

// ── Расписание ──────────────────────────────────────────────────────────────

/**
 * Интервал графика работы врача — ответ DOCT_SCHEDULE.
 * Используется для кэширования плана работы (раз в 30 мин).
 */
export interface IcScheduleInterval {
  /** Идентификатор интервала графика */
  SCHEDIDENT: number;
  DCODE: number;
  DNAME: string;
  DEPNUM: number;
  DEPNAME: string;
  FILIAL: number;
  FNAME: string;
  /** Дата работы YYYYMMDD */
  WDATE: string;
  BEGHOUR: number;
  BEGMIN: number;
  ENDHOUR: number;
  ENDMIN: number;
  /**
   * Режим приёма:
   * 0 – плановый в клинике
   * 1 – плановый в клинике или онлайн
   * 2 – дежурный онлайн
   * 3 – только онлайн
   */
  ONLINEMODE: number;
}

/**
 * Слот сетки расписания — ответ SCHEDULE (конкретная ячейка времени).
 * Запрашивается каждый раз при обслуживании запроса пациента.
 * Кэширование допустимо не более 5 минут.
 */
export interface IcFreeSlot {
  /** Идентификатор интервала (используется при записи в SHEDIDENT) */
  SHEDIDENT: number;
  DCODE: number;
  /** Дата YYYYMMDD */
  WDATE: string;
  BHOUR: number;
  BMIN: number;
  FHOUR: number;
  FMIN: number;
  /**
   * Признак занятости:
   * 0 – свободен
   * 1 – занят пациентом
   * 2 – запись с сайта запрещена
   * 3 – запись на резерв запрещена
   * 4 – только на резервы
   * 5 – минимальный интервал до даты
   * 6 – прошедшее время
   * 7 – слишком короткий интервал
   * 8 – ограничение по категории пациента
   * 9 – нестандартный интервал
   */
  FREETYPE: number;
  FILIAL: number;
  DEPNUM: number;
}

// ── Запись ──────────────────────────────────────────────────────────────────

/** Параметры создания записи — запрос SCHEDULE_REC_RESERVE */
export interface IcBookingRequest {
  /** Идентификатор врача */
  DCODE: number;
  /** Дата записи YYYYMMDD */
  WORKDATE: string;
  BHOUR: number;
  BMIN: number;
  FHOUR: number;
  FMIN: number;
  /** Идентификатор интервала графика работы из DOCT_SCHEDULE */
  SHEDIDENT: number;
  /** Идентификатор отделения */
  DEPNUM: number;
  /**
   * Идентификатор пациента (PCODE = -1 для анонимной записи).
   * При анонимной записи ФИО и телефон передаются в ANOTE.
   */
  PCODE: number;
  /** Комментарий. Для анонимных: "Фамилия Имя Отчество, phone: +7(123)456-78-90" */
  ANOTE?: string;
  /**
   * Тип записи:
   * 0 – плановый в клинике
   * 1 – плановый онлайн
   * 2 – дежурный онлайн
   */
  ONLINETYPE: number;
  /** Внешний идентификатор записи (CALLERID) для сквозной аналитики */
  CALLERID?: string;
  /** Идентификатор назначения при переносе записи */
  SCHEDID?: number;
}

/** Результат создания записи — ответ SCHEDULE_REC_RESERVE */
export interface IcBookingResult {
  /** 1 = успех, иное = ошибка */
  SPRESULT: number;
  /** Текст ошибки при SPRESULT != 1 */
  SPCOMMENT: string;
  /** Идентификатор созданной записи в МИС */
  SCHEDID?: number;
  /** Расширенное описание ошибки для показа пользователю */
  CHECKTEXT?: string;
}

/** Результат отмены записи — ответ SCHEDULE_REC_REMOVE */
export interface IcCancelResult {
  SPRESULT: number;
  SPCOMMENT: string;
}

// ── Пациент ─────────────────────────────────────────────────────────────────

/** Параметры регистрации пациента — запрос CLIENT_ADD */
export interface IcPatientRegisterRequest {
  LASTNAME: string;
  FIRSTNAME: string;
  MIDNAME?: string;
  /** Формат: +7(000)000-00-00 */
  PHONE: string;
  /** Дата рождения YYYYMMDD */
  BDATE: string;
  /** 1 = мужской, 2 = женский */
  GENDER: 1 | 2;
}

/** Результат регистрации пациента — ответ CLIENT_ADD */
export interface IcPatientResult {
  SPRESULT: number;
  SPCOMMENT: string;
  /** Идентификатор пациента. Не хранить долгосрочно — может измениться при объединении */
  PCODE?: number;
}

// ── Список изменений по записям ─────────────────────────────────────────────

export interface IcAppointmentChange {
  CHANGEID: number;
  /** 0 = добавление, 1 = изменение, 2 = удаление */
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

// ── Услуги ──────────────────────────────────────────────────────────────────

/** Услуга из прайс-листа — ответ PRICE_LIST */
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
  /** 0 = запись запрещена */
  SCHSCHEDTYPE: number;
}

// ── Интерфейс клиента ────────────────────────────────────────────────────────

/**
 * Контракт HTTP-клиента Инфоклиника.
 * Реализуется MockClient (тест) и RealClient (prod).
 */
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
