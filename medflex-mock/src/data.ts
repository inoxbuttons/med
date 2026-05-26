/**
 * Статические mock-данные. Структура — точное соответствие MedFlex API:
 *  - SPECIALITIES (`/models/speciality/`)        — квалификация врача
 *  - LPUS         (`/models/lpu/`)               — клиники, со списком specialities
 *  - DOCTORS      (`/models/doctor/`)            — врачи, со списком specialities + цены приёма
 *  - SERVICE_CATEGORIES (`/services/categories/?lpu_id=…`)
 *  - SERVICES           (`/services/prices/?lpu_id=…&doctor_id=…&category_ids=…`)
 *
 * Услуги ≠ специальности. Услуга — конкретная процедура (УЗИ сердца, пилинг),
 * связана с врачами через doctor_ids. Бронирование идёт по специальности
 * (`/direct_appointment/doctor/execute/` принимает doctor.speciality_id),
 * а price для appointment.price берётся либо из DoctorLpuSpecialityPrice (приём),
 * либо из service.price (процедура).
 *
 * Ограничения для тестов (важно не нарушать):
 *   - Иванова (1001) — Терапевт, Пн/Ср/Пт в LPU 101, Вт/Чт в LPU 102.
 *   - Петров (1004) — единственный Терапевт, работающий в субботу (тест A4).
 *   - Беляева (1006) — единственная Косметолог с субботним графиком (G2).
 *   - Соколов (1008) — единственный врач, которому привязана УЗИ сердца (G1).
 *   - НИ ОДИН врач не работает в воскресенье (тест cycle1 "воскресенье → нет слотов").
 *   - Новые терапевты (1020, 1034, 1044) — только Пн-Пт, без субботы.
 */

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

export interface DoctorPrice {
  speciality_id: number;
  price: number | null;
}

export interface WorkingHours {
  lpu_id: number;
  /** Дни недели: 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб, 7=Вс */
  days: number[];
  start: string;    // "HH:MM"
  end: string;      // "HH:MM"
  slotMin: number;  // длительность слота в минутах
}

export interface DoctorDef {
  id: number;
  efio: string;
  specialities: number[];
  lpus: number[];
  prices: DoctorPrice[];
  rating?: { stars: number; public: number };
  workingHours: WorkingHours[];
}

/** Категория услуг (per `/services/categories/`). */
export interface MfServiceCategory {
  id: number;
  name: string;
}

/**
 * Услуга (per `/services/prices/`). `id` — строка по спеке. `duration` может быть null.
 * Поле `lpu_id` нужно мок-серверу для фильтрации по клинике (в реальном API оно
 * содержится в обёртке data.lpu_id, а каждая услуга возвращается per-lpu запросом).
 */
export interface MfService {
  id: string;
  category_id: number;
  name: string;
  duration: number | null;
  price: number;
  doctor_ids: number[];
  /** Mock-only: к какой клинике привязана услуга (для фильтрации). */
  lpu_id: number;
}

// ── Специальности ─────────────────────────────────────────────────────────────

export const SPECIALITIES: MfSpeciality[] = [
  { id: 1,  name: 'Терапевт' },
  { id: 2,  name: 'Кардиолог' },
  { id: 3,  name: 'Невролог' },
  { id: 4,  name: 'Хирург' },
  { id: 5,  name: 'Офтальмолог' },
  { id: 6,  name: 'Дерматолог' },
  { id: 7,  name: 'Гинеколог' },
  { id: 8,  name: 'Эндокринолог' },
  { id: 9,  name: 'Косметолог' },
  { id: 10, name: 'Врач УЗИ' },
  { id: 11, name: 'Уролог' },
  { id: 12, name: 'Проктолог' },
  { id: 13, name: 'Оториноларинголог' },
  { id: 14, name: 'Гастроэнтеролог' },
  { id: 15, name: 'Травматолог-ортопед' },
  { id: 16, name: 'Аллерголог-иммунолог' },
  { id: 17, name: 'Гематолог' },
  { id: 18, name: 'Нефролог' },
  { id: 19, name: 'Онколог-маммолог' },
];

// ── Клиники ───────────────────────────────────────────────────────────────────

export const LPUS: MfLpu[] = [
  // Сеть 1 (lpu_group_id=1) — «XXI Век»
  {
    id: 101,
    lpu_group_id: 1,
    name: 'Клиника XXI Век на Ленина',
    address: 'ул. Ленина, 10, Санкт-Петербург',
    phone: '+7 (812) 100-01-01',
    town_id: 2,
    town_name: 'Санкт-Петербург',
    direct_appointment_is_supported: true,
    cancel_appointment_is_supported: true,
    is_visible: true,
    specialities: [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  },
  {
    id: 102,
    lpu_group_id: 1,
    name: 'Клиника XXI Век на Мира',
    address: 'ул. Мира, 25, Санкт-Петербург',
    phone: '+7 (812) 100-01-02',
    town_id: 2,
    town_name: 'Санкт-Петербург',
    direct_appointment_is_supported: true,
    cancel_appointment_is_supported: true,
    is_visible: true,
    specialities: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 16, 19],
  },
  {
    id: 103,
    lpu_group_id: 1,
    name: 'Клиника XXI Век на Гагарина',
    address: 'пр. Гагарина, 3, Санкт-Петербург',
    phone: '+7 (812) 100-01-03',
    town_id: 2,
    town_name: 'Санкт-Петербург',
    direct_appointment_is_supported: false,  // online-запись не поддерживается
    cancel_appointment_is_supported: false,
    is_visible: true,
    specialities: [1, 4],
  },
  // Сеть 2 (lpu_group_id=2) — «МедЦентр»
  {
    id: 201,
    lpu_group_id: 2,
    name: 'МедЦентр Здоровье на Науки',
    address: 'пр. Науки, 5, Санкт-Петербург',
    phone: '+7 (812) 200-02-01',
    town_id: 2,
    town_name: 'Санкт-Петербург',
    direct_appointment_is_supported: true,
    cancel_appointment_is_supported: true,
    is_visible: true,
    specialities: [1, 2, 5, 8],
  },
  {
    id: 202,
    lpu_group_id: 2,
    name: 'МедЦентр Здоровье на Просвещения',
    address: 'пр. Просвещения, 88, Санкт-Петербург',
    phone: '+7 (812) 200-02-02',
    town_id: 2,
    town_name: 'Санкт-Петербург',
    direct_appointment_is_supported: true,
    cancel_appointment_is_supported: true,
    is_visible: true,
    specialities: [1, 3, 6, 7],
  },
];

// ── Врачи ─────────────────────────────────────────────────────────────────────

export const DOCTORS: DoctorDef[] = [
  // ── Базовый набор (используется в тестах cycle1/2/3) ────────────────────────
  {
    id: 1001,
    efio: 'Иванова Мария Петровна',
    specialities: [1],
    lpus: [101, 102],
    prices: [{ speciality_id: 1, price: 1500 }],
    rating: { stars: 4.8, public: 142 },
    workingHours: [
      { lpu_id: 101, days: [1, 3, 5], start: '09:00', end: '15:00', slotMin: 30 },
      { lpu_id: 102, days: [2, 4],    start: '10:00', end: '16:00', slotMin: 30 },
    ],
  },
  {
    id: 1002,
    efio: 'Смирнов Алексей Дмитриевич',
    specialities: [2],
    lpus: [101],
    prices: [{ speciality_id: 2, price: 2500 }],
    rating: { stars: 4.9, public: 87 },
    workingHours: [
      { lpu_id: 101, days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', slotMin: 30 },
    ],
  },
  {
    id: 1003,
    efio: 'Козлова Наталья Сергеевна',
    specialities: [3],
    lpus: [101, 102],
    prices: [{ speciality_id: 3, price: 2000 }],
    rating: { stars: 4.7, public: 201 },
    workingHours: [
      { lpu_id: 101, days: [1, 3],       start: '08:00', end: '14:00', slotMin: 30 },
      { lpu_id: 102, days: [2, 4, 5],    start: '13:00', end: '19:00', slotMin: 30 },
    ],
  },
  {
    // Петров — ЕДИНСТВЕННЫЙ Терапевт с субботним графиком (тест A4 кейс).
    id: 1004,
    efio: 'Петров Дмитрий Иванович',
    specialities: [4, 1],
    lpus: [101],
    prices: [
      { speciality_id: 4, price: 3000 },
      { speciality_id: 1, price: 1500 },
    ],
    rating: { stars: 4.6, public: 53 },
    workingHours: [
      { lpu_id: 101, days: [2, 4, 6], start: '10:00', end: '18:00', slotMin: 30 },
    ],
  },
  {
    id: 1005,
    efio: 'Сидорова Анна Владимировна',
    specialities: [6, 7],
    lpus: [102],
    prices: [
      { speciality_id: 6, price: 1800 },
      { speciality_id: 7, price: 2200 },
    ],
    workingHours: [
      { lpu_id: 102, days: [1, 2, 3, 4, 5], start: '09:00', end: '15:00', slotMin: 30 },
    ],
  },
  {
    // Беляева — единственная Косметолог с субботним графиком (тест G2).
    id: 1006,
    efio: 'Беляева Ольга Игоревна',
    specialities: [9],
    lpus: [102],
    prices: [{ speciality_id: 9, price: 2500 }],
    rating: { stars: 4.9, public: 178 },
    workingHours: [
      { lpu_id: 102, days: [1, 2, 3, 4, 5], start: '10:00', end: '20:00', slotMin: 60 },
      { lpu_id: 102, days: [6],             start: '11:00', end: '17:00', slotMin: 60 },
    ],
  },
  {
    id: 1007,
    efio: 'Морозова Татьяна Сергеевна',
    specialities: [9],
    lpus: [102],
    prices: [{ speciality_id: 9, price: 2200 }],
    rating: { stars: 4.7, public: 96 },
    workingHours: [
      { lpu_id: 102, days: [2, 4], start: '11:00', end: '19:00', slotMin: 60 },
      { lpu_id: 102, days: [6],    start: '10:00', end: '15:00', slotMin: 60 },
    ],
  },
  {
    // Соколов — единственный врач, к которому привязана УЗИ сердца (тест G1).
    id: 1008,
    efio: 'Соколов Игорь Викторович',
    specialities: [10],
    lpus: [102],
    prices: [{ speciality_id: 10, price: 2000 }],
    rating: { stars: 4.8, public: 124 },
    workingHours: [
      { lpu_id: 102, days: [1, 2, 3, 4, 5], start: '09:00', end: '14:00', slotMin: 30 },
    ],
  },
  // Сеть 2
  {
    id: 2001,
    efio: 'Нестерова Юлия Владимировна',
    specialities: [1],
    lpus: [201],
    prices: [{ speciality_id: 1, price: 1800 }],
    rating: { stars: 5.0, public: 318 },
    workingHours: [
      { lpu_id: 201, days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', slotMin: 30 },
    ],
  },
  {
    id: 2002,
    efio: 'Волков Игорь Анатольевич',
    specialities: [2, 8],
    lpus: [201, 202],
    prices: [
      { speciality_id: 2, price: 2800 },
      { speciality_id: 8, price: 2200 },
    ],
    workingHours: [
      { lpu_id: 201, days: [1, 3, 5], start: '10:00', end: '18:00', slotMin: 30 },
      { lpu_id: 202, days: [2, 4],    start: '09:00', end: '15:00', slotMin: 30 },
    ],
  },
  {
    id: 2003,
    efio: 'Орлова Светлана Николаевна',
    specialities: [3, 6],
    lpus: [202],
    prices: [
      { speciality_id: 3, price: 2100 },
      { speciality_id: 6, price: 1900 },
    ],
    workingHours: [
      { lpu_id: 202, days: [1, 2, 3, 4, 5], start: '12:00', end: '20:00', slotMin: 30 },
    ],
  },

  // ── Расширенный набор (импортирован из основной базы клиники) ───────────────
  // Без воскресных смен — это сломало бы тест cycle1 "воскресенье → нет слотов".
  // Терапевты без субботы — это сломало бы A4 (отбор Петрова по субботе).

  // Онколог-маммолог
  {
    id: 1009,
    efio: 'Амерханова Мадина Магомедовна',
    specialities: [19],
    lpus: [101, 102],
    prices: [{ speciality_id: 19, price: 2800 }],
    rating: { stars: 4.8, public: 92 },
    workingHours: [
      { lpu_id: 101, days: [1, 3, 5], start: '10:00', end: '16:00', slotMin: 30 },
      { lpu_id: 102, days: [2, 4],    start: '13:00', end: '19:00', slotMin: 30 },
    ],
  },
  // Урологи
  {
    id: 1010,
    efio: 'Василевский Константин Анатольевич',
    specialities: [11],
    lpus: [101],
    prices: [{ speciality_id: 11, price: 2400 }],
    rating: { stars: 4.7, public: 134 },
    workingHours: [
      { lpu_id: 101, days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', slotMin: 30 },
    ],
  },
  {
    id: 1017,
    efio: 'Исмаилов Руслан Самедович',
    specialities: [11],
    lpus: [101, 102],
    prices: [{ speciality_id: 11, price: 2300 }],
    rating: { stars: 4.6, public: 87 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '14:00', end: '20:00', slotMin: 30 },
      { lpu_id: 102, days: [1, 3, 5], start: '09:00', end: '14:00', slotMin: 30 },
    ],
  },
  {
    id: 1039,
    efio: 'Тен Николай Сергеевич',
    specialities: [11],
    lpus: [101],
    prices: [{ speciality_id: 11, price: 2600 }],
    rating: { stars: 4.9, public: 211 },
    workingHours: [
      { lpu_id: 101, days: [1, 3, 5], start: '10:00', end: '18:00', slotMin: 30 },
      { lpu_id: 101, days: [6],       start: '11:00', end: '15:00', slotMin: 30 },
    ],
  },
  // Нефролог
  {
    id: 1011,
    efio: 'Галушкин Александр Алексеевич',
    specialities: [18],
    lpus: [101],
    prices: [{ speciality_id: 18, price: 2700 }],
    rating: { stars: 4.7, public: 64 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '10:00', end: '16:00', slotMin: 30 },
    ],
  },
  // Врачи УЗИ (без УЗИ сердца — оно остаётся за Соколовым 1008)
  {
    id: 1012,
    efio: 'Гревцева Ксения Вениаминовна',
    specialities: [10],
    lpus: [101],
    prices: [{ speciality_id: 10, price: 1900 }],
    rating: { stars: 4.8, public: 156 },
    workingHours: [
      { lpu_id: 101, days: [1, 3, 5], start: '09:00', end: '14:00', slotMin: 30 },
    ],
  },
  {
    id: 1013,
    efio: 'Елисеева Эльвира Геннадьевна',
    specialities: [10],
    lpus: [102],
    prices: [{ speciality_id: 10, price: 1800 }],
    rating: { stars: 4.6, public: 73 },
    workingHours: [
      { lpu_id: 102, days: [2, 4], start: '14:00', end: '19:00', slotMin: 30 },
    ],
  },
  {
    id: 1015,
    efio: 'Зиновьева Татьяна Валерьевна',
    specialities: [10],
    lpus: [101],
    prices: [{ speciality_id: 10, price: 2000 }],
    rating: { stars: 4.9, public: 188 },
    workingHours: [
      { lpu_id: 101, days: [1, 3, 5], start: '14:00', end: '19:00', slotMin: 30 },
    ],
  },
  // Проктологи
  {
    id: 1014,
    efio: 'Занимонец Пётр Юрьевич',
    specialities: [12],
    lpus: [101],
    prices: [{ speciality_id: 12, price: 2500 }],
    rating: { stars: 4.7, public: 117 },
    workingHours: [
      { lpu_id: 101, days: [1, 2, 3, 4, 5], start: '10:00', end: '18:00', slotMin: 30 },
    ],
  },
  {
    id: 1021,
    efio: 'Куликова Елена Валерьевна',
    specialities: [12],
    lpus: [101],
    prices: [{ speciality_id: 12, price: 2400 }],
    rating: { stars: 4.8, public: 96 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '09:00', end: '14:00', slotMin: 30 },
      { lpu_id: 101, days: [6],    start: '10:00', end: '14:00', slotMin: 30 },
    ],
  },
  // Гинекологи (помимо Сидоровой 1005)
  {
    id: 1016,
    efio: 'Иващенко Ольга Евгеньевна',
    specialities: [7],
    lpus: [101, 102],
    prices: [{ speciality_id: 7, price: 2300 }],
    rating: { stars: 4.9, public: 245 },
    workingHours: [
      { lpu_id: 101, days: [1, 3], start: '09:00', end: '15:00', slotMin: 30 },
      { lpu_id: 102, days: [2, 4, 5], start: '10:00', end: '17:00', slotMin: 30 },
    ],
  },
  {
    id: 1019,
    efio: 'Карапетян Инга Борисовна',
    specialities: [7],
    lpus: [101],
    prices: [{ speciality_id: 7, price: 2400 }],
    rating: { stars: 4.7, public: 142 },
    workingHours: [
      { lpu_id: 101, days: [1, 2, 3, 4, 5], start: '12:00', end: '20:00', slotMin: 30 },
    ],
  },
  {
    id: 1030,
    efio: 'Пастух Дарья Алексеевна',
    specialities: [7],
    lpus: [102],
    prices: [{ speciality_id: 7, price: 2200 }],
    rating: { stars: 4.8, public: 78 },
    workingHours: [
      { lpu_id: 102, days: [1, 3, 5], start: '09:00', end: '14:00', slotMin: 30 },
    ],
  },
  {
    id: 1032,
    efio: 'Попович Диана Николаевна',
    specialities: [7],
    lpus: [101],
    prices: [{ speciality_id: 7, price: 2500 }],
    rating: { stars: 4.9, public: 312 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '14:00', end: '20:00', slotMin: 30 },
      { lpu_id: 101, days: [6],    start: '10:00', end: '14:00', slotMin: 30 },
    ],
  },
  {
    id: 1036,
    efio: 'Седова Елена Сергеевна',
    specialities: [7, 10],
    lpus: [101, 102],
    prices: [
      { speciality_id: 7,  price: 2400 },
      { speciality_id: 10, price: 1900 },
    ],
    rating: { stars: 4.8, public: 167 },
    workingHours: [
      { lpu_id: 101, days: [1, 3], start: '10:00', end: '15:00', slotMin: 30 },
      { lpu_id: 102, days: [2, 4, 5], start: '11:00', end: '17:00', slotMin: 30 },
    ],
  },
  {
    id: 1045,
    efio: 'Шаповалов Богдан Игоревич',
    specialities: [7, 4],
    lpus: [101],
    prices: [
      { speciality_id: 7, price: 2800 },
      { speciality_id: 4, price: 3500 },
    ],
    rating: { stars: 4.7, public: 89 },
    workingHours: [
      { lpu_id: 101, days: [1, 3, 5], start: '10:00', end: '16:00', slotMin: 30 },
    ],
  },
  {
    id: 1049,
    efio: 'Щербин Сергей Васильевич',
    specialities: [7, 4],
    lpus: [101],
    prices: [
      { speciality_id: 7, price: 2700 },
      { speciality_id: 4, price: 3500 },
    ],
    rating: { stars: 4.6, public: 71 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '10:00', end: '16:00', slotMin: 30 },
    ],
  },
  // ЛОР
  {
    id: 1018,
    efio: 'Камбаров Жамол Камилжанович',
    specialities: [13],
    lpus: [101, 102],
    prices: [{ speciality_id: 13, price: 2200 }],
    rating: { stars: 4.8, public: 198 },
    workingHours: [
      { lpu_id: 101, days: [1, 3, 5], start: '09:00', end: '15:00', slotMin: 30 },
      { lpu_id: 102, days: [2, 4],    start: '10:00', end: '16:00', slotMin: 30 },
    ],
  },
  {
    id: 1023,
    efio: 'Лаврухина Татьяна Васильевна',
    specialities: [13],
    lpus: [101],
    prices: [{ speciality_id: 13, price: 2100 }],
    rating: { stars: 4.7, public: 124 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '14:00', end: '20:00', slotMin: 30 },
      { lpu_id: 101, days: [6],    start: '10:00', end: '15:00', slotMin: 30 },
    ],
  },
  // Дерматологи (помимо Сидоровой 1005)
  {
    id: 1024,
    efio: 'Ли Анна Александровна',
    specialities: [6],
    lpus: [102],
    prices: [{ speciality_id: 6, price: 1900 }],
    rating: { stars: 4.6, public: 88 },
    workingHours: [
      { lpu_id: 102, days: [1, 3, 5], start: '10:00', end: '15:00', slotMin: 30 },
    ],
  },
  {
    id: 1037,
    efio: 'Середа Анна Николаевна',
    specialities: [6],
    lpus: [102],
    prices: [{ speciality_id: 6, price: 2000 }],
    rating: { stars: 4.8, public: 154 },
    workingHours: [
      { lpu_id: 102, days: [2, 4], start: '14:00', end: '19:00', slotMin: 30 },
    ],
  },
  // Кардиологи (помимо Смирнова 1002)
  {
    id: 1026,
    efio: 'Марайкин Владимир Олегович',
    specialities: [2],
    lpus: [101],
    prices: [{ speciality_id: 2, price: 2700 }],
    rating: { stars: 4.9, public: 230 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '10:00', end: '16:00', slotMin: 30 },
    ],
  },
  {
    id: 1035,
    efio: 'Саргсян Ася Ашотовна',
    specialities: [2],
    lpus: [102],
    prices: [{ speciality_id: 2, price: 2500 }],
    rating: { stars: 4.7, public: 92 },
    workingHours: [
      { lpu_id: 102, days: [1, 3, 5], start: '13:00', end: '19:00', slotMin: 30 },
    ],
  },
  // Хирурги (помимо Петрова 1004)
  {
    id: 1027,
    efio: 'Минченко Юрий Владимирович',
    specialities: [4],
    lpus: [101],
    prices: [{ speciality_id: 4, price: 3200 }],
    rating: { stars: 4.8, public: 145 },
    workingHours: [
      { lpu_id: 101, days: [1, 3, 5], start: '10:00', end: '18:00', slotMin: 30 },
    ],
  },
  {
    id: 1046,
    efio: 'Шипилов Антон Валерьевич',
    specialities: [4],
    lpus: [101],
    prices: [{ speciality_id: 4, price: 3000 }],
    rating: { stars: 4.6, public: 67 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '09:00', end: '15:00', slotMin: 30 },
    ],
  },
  // Гастроэнтерологи
  {
    id: 1028,
    efio: 'Нестерова Инна Ивановна',
    specialities: [14],
    lpus: [101, 102],
    prices: [{ speciality_id: 14, price: 2300 }],
    rating: { stars: 4.9, public: 187 },
    workingHours: [
      { lpu_id: 101, days: [1, 3], start: '09:00', end: '15:00', slotMin: 30 },
      { lpu_id: 102, days: [2, 4, 5], start: '10:00', end: '16:00', slotMin: 30 },
    ],
  },
  {
    id: 1040,
    efio: 'Тепикина Екатерина Александровна',
    specialities: [14],
    lpus: [101],
    prices: [{ speciality_id: 14, price: 2400 }],
    rating: { stars: 4.7, public: 102 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '12:00', end: '18:00', slotMin: 30 },
    ],
  },
  // Травматологи-ортопеды
  {
    id: 1029,
    efio: 'Николаевский Дмитрий Сергеевич',
    specialities: [15],
    lpus: [101],
    prices: [{ speciality_id: 15, price: 2600 }],
    rating: { stars: 4.8, public: 215 },
    workingHours: [
      { lpu_id: 101, days: [1, 2, 3, 4, 5], start: '10:00', end: '17:00', slotMin: 30 },
      { lpu_id: 101, days: [6],             start: '10:00', end: '14:00', slotMin: 30 },
    ],
  },
  {
    id: 1038,
    efio: 'Стрельников Алексей Владимирович',
    specialities: [15],
    lpus: [101],
    prices: [{ speciality_id: 15, price: 2500 }],
    rating: { stars: 4.6, public: 88 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '14:00', end: '20:00', slotMin: 30 },
    ],
  },
  // Аллерголог-иммунолог
  {
    id: 1031,
    efio: 'Поколева Юлия Анатольевна',
    specialities: [16],
    lpus: [101, 102],
    prices: [{ speciality_id: 16, price: 2200 }],
    rating: { stars: 4.7, public: 119 },
    workingHours: [
      { lpu_id: 101, days: [1, 3], start: '09:00', end: '14:00', slotMin: 30 },
      { lpu_id: 102, days: [2, 4, 5], start: '14:00', end: '19:00', slotMin: 30 },
    ],
  },
  // Гематолог
  {
    id: 1047,
    efio: 'Широкова Зинаида Андреевна',
    specialities: [17],
    lpus: [101],
    prices: [{ speciality_id: 17, price: 2800 }],
    rating: { stars: 4.8, public: 74 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '09:00', end: '15:00', slotMin: 30 },
    ],
  },
  // Неврологи (помимо Козловой 1003)
  {
    id: 1022,
    efio: 'Куликова Ольга Михайловна',
    specialities: [3],
    lpus: [101],
    prices: [{ speciality_id: 3, price: 2200 }],
    rating: { stars: 4.7, public: 128 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '14:00', end: '20:00', slotMin: 30 },
    ],
  },
  {
    id: 1041,
    efio: 'Тертышная Наталия Михайловна',
    specialities: [3],
    lpus: [102],
    prices: [{ speciality_id: 3, price: 2100 }],
    rating: { stars: 4.8, public: 156 },
    workingHours: [
      { lpu_id: 102, days: [1, 3, 5], start: '10:00', end: '16:00', slotMin: 30 },
    ],
  },
  {
    id: 1050,
    efio: 'Яцук Анастасия Николаевна',
    specialities: [3],
    lpus: [101],
    prices: [{ speciality_id: 3, price: 2300 }],
    rating: { stars: 4.9, public: 203 },
    workingHours: [
      { lpu_id: 101, days: [1, 3, 5], start: '13:00', end: '19:00', slotMin: 30 },
    ],
  },
  // Офтальмологи (новые)
  {
    id: 1033,
    efio: 'Проскурина Светлана Тимофеевна',
    specialities: [5],
    lpus: [101, 102],
    prices: [{ speciality_id: 5, price: 2000 }],
    rating: { stars: 4.7, public: 142 },
    workingHours: [
      { lpu_id: 101, days: [1, 3, 5], start: '09:00', end: '15:00', slotMin: 30 },
      { lpu_id: 102, days: [2, 4],    start: '13:00', end: '18:00', slotMin: 30 },
    ],
  },
  {
    id: 1042,
    efio: 'Фурсов Семён Сергеевич',
    specialities: [5],
    lpus: [101],
    prices: [{ speciality_id: 5, price: 1900 }],
    rating: { stars: 4.6, public: 73 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '14:00', end: '19:00', slotMin: 30 },
    ],
  },
  // Эндокринолог (новый, помимо Сети 2)
  {
    id: 1043,
    efio: 'Хачумова Анна Витальевна',
    specialities: [8],
    lpus: [101],
    prices: [{ speciality_id: 8, price: 2400 }],
    rating: { stars: 4.8, public: 134 },
    workingHours: [
      { lpu_id: 101, days: [1, 3, 5], start: '10:00', end: '16:00', slotMin: 30 },
    ],
  },
  // Терапевты (новые) — все БЕЗ субботы, чтобы тест A4 продолжал отбирать Петрова.
  {
    id: 1020,
    efio: 'Касумов Гаджи Шевкетович',
    specialities: [1],
    lpus: [101],
    prices: [{ speciality_id: 1, price: 1500 }],
    rating: { stars: 4.6, public: 65 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '14:00', end: '19:00', slotMin: 30 },
    ],
  },
  {
    id: 1034,
    efio: 'Савченко Илона Олеговна',
    specialities: [1],
    lpus: [102],
    prices: [{ speciality_id: 1, price: 1600 }],
    rating: { stars: 4.7, public: 92 },
    workingHours: [
      { lpu_id: 102, days: [1, 3, 5], start: '14:00', end: '19:00', slotMin: 30 },
    ],
  },
  {
    id: 1044,
    efio: 'Шанько Наталья Владимировна',
    specialities: [1],
    lpus: [101],
    prices: [{ speciality_id: 1, price: 1500 }],
    rating: { stars: 4.5, public: 38 },
    workingHours: [
      { lpu_id: 101, days: [2, 4], start: '09:00', end: '13:00', slotMin: 30 },
    ],
  },
];

// ── Категории услуг ───────────────────────────────────────────────────────────

export const SERVICE_CATEGORIES: MfServiceCategory[] = [
  { id: 1,  name: 'Косметология' },
  { id: 2,  name: 'УЗИ-диагностика' },
  { id: 3,  name: 'Урология' },
  { id: 4,  name: 'Оториноларингология (ЛОР)' },
  { id: 5,  name: 'Гинекология' },
  { id: 6,  name: 'Проктология' },
  { id: 7,  name: 'Гастроэнтерология' },
  { id: 8,  name: 'Травматология-ортопедия' },
  { id: 9,  name: 'Аллергология' },
  { id: 10, name: 'Неврология' },
  { id: 11, name: 'Эндокринология' },
];

// ── Услуги ────────────────────────────────────────────────────────────────────
// Услуги привязаны к конкретной клинике через lpu_id и к врачам через doctor_ids.

const UROLOG_DOCS = [1010, 1017, 1039];
const LOR_DOCS    = [1018, 1023];
const GYN_DOCS    = [1005, 1016, 1019, 1030, 1032, 1036, 1045, 1049];
const PROCT_DOCS  = [1014, 1021];
const GASTRO_DOCS = [1028, 1040];
const TRAUMA_DOCS = [1029, 1038];
const ALLERG_DOCS = [1031];
const NEUR_DOCS   = [1003, 1022, 1041, 1050];
const ENDO_DOCS   = [1043];

export const SERVICES: MfService[] = [
  // ── Косметология (cat 1) — врачи Беляева 1006, Морозова 1007 ───────────────
  { id: '5001', category_id: 1, name: 'Биоармирование',                                                    duration: 60, price: 35000, doctor_ids: [1006],       lpu_id: 102 },
  { id: '5002', category_id: 1, name: 'Введение филлеров (коррекция форм)',                                duration: 60, price: 25000, doctor_ids: [1006],       lpu_id: 102 },
  { id: '5003', category_id: 1, name: 'Внутримышечное введение ботулотоксина (ботокс)',                    duration: 30, price: 11500, doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5004', category_id: 1, name: 'Внутри/подкожное введение лекарственного препарата',                duration: 30, price: 1500,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5005', category_id: 1, name: 'Внутри/подкожное введение лекарственного препарата (гл. врач)',     duration: 30, price: 2500,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5006', category_id: 1, name: 'Дарсонвализация',                                                   duration: 30, price: 1200,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5007', category_id: 1, name: 'Дерматологический пилинг',                                          duration: 60, price: 4200,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5008', category_id: 1, name: 'Игольчатый RF-лифтинг МОРФЕУС8',                                    duration: 90, price: 35000, doctor_ids: [1006],       lpu_id: 102 },
  { id: '5009', category_id: 1, name: 'Консультация косметолога',                                          duration: 30, price: 1900,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5010', category_id: 1, name: 'Коррекция бровей и ресниц',                                         duration: 30, price: 1500,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5011', category_id: 1, name: 'Косметика Angiopharm',                                              duration: 60, price: 5500,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5012', category_id: 1, name: 'Лазерная эпиляция',                                                 duration: 60, price: 5000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5013', category_id: 1, name: 'Липолиз',                                                           duration: 60, price: 6000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5014', category_id: 1, name: 'Массаж лица медицинский',                                           duration: 30, price: 3500,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5015', category_id: 1, name: 'Микротоковое воздействие при заболеваниях кожи и ПЖК',              duration: 30, price: 2800,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5016', category_id: 1, name: 'Оздоровительно-профилактический массаж тела',                       duration: 60, price: 4000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5017', category_id: 1, name: 'Пакет Массаж миофасцеальный 60 мин',                                duration: 60, price: 5000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5018', category_id: 1, name: 'Пирсинг',                                                           duration: 30, price: 2400,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5019', category_id: 1, name: 'Плазмолифтинг',                                                     duration: 60, price: 7800,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5020', category_id: 1, name: 'Уходы за лицом',                                                    duration: 60, price: 4500,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5021', category_id: 1, name: 'Фотоомоложение IPL терапия (Lumecca)',                              duration: 60, price: 12000, doctor_ids: [1006],       lpu_id: 102 },
  { id: '5022', category_id: 1, name: 'Фототерапия IPL терапия (Lumecca): сосуды',                         duration: 30, price: 9000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5023', category_id: 1, name: 'Фототерапия IPL терапия (Lumecca): удаление пигмента',              duration: 30, price: 9000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5024', category_id: 1, name: 'Холодная плазма',                                                   duration: 30, price: 6200,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5025', category_id: 1, name: 'Чистка лица',                                                       duration: 60, price: 3400,  doctor_ids: [1006, 1007], lpu_id: 102 },

  // ── УЗИ (cat 2) — только Соколов 1008 (тест G1 проверяет doctorId=1008) ────
  { id: '5101', category_id: 2, name: 'УЗИ сердца',                                                        duration: 30, price: 3500,  doctor_ids: [1008],       lpu_id: 102 },
  { id: '5102', category_id: 2, name: 'УЗИ органов брюшной полости',                                       duration: 45, price: 3000,  doctor_ids: [1008],       lpu_id: 102 },
  { id: '5103', category_id: 2, name: 'УЗИ щитовидной железы',                                             duration: 20, price: 2500,  doctor_ids: [1008],       lpu_id: 102 },
  { id: '5104', category_id: 2, name: 'УЗИ почек',                                                         duration: 20, price: 2500,  doctor_ids: [1008],       lpu_id: 102 },
  { id: '5105', category_id: 2, name: 'УЗИ мочевого пузыря',                                               duration: 15, price: 2200,  doctor_ids: [1008],       lpu_id: 102 },

  // ── Урология (cat 3) ────────────────────────────────────────────────────────
  { id: '5201', category_id: 3, name: 'Замена катетера Пеццера, Фоллея',                                   duration: 30, price: 2800,  doctor_ids: UROLOG_DOCS,  lpu_id: 101 },
  { id: '5202', category_id: 3, name: 'Соскоб мужской уретры',                                             duration: 15, price: 1200,  doctor_ids: UROLOG_DOCS,  lpu_id: 101 },
  { id: '5203', category_id: 3, name: 'Забор сока предстательной железы',                                  duration: 20, price: 1800,  doctor_ids: UROLOG_DOCS,  lpu_id: 101 },
  { id: '5204', category_id: 3, name: 'Бужирование уретры',                                                duration: 30, price: 3200,  doctor_ids: UROLOG_DOCS,  lpu_id: 101 },
  { id: '5205', category_id: 3, name: 'Катетеризация мочевого пузыря у мужчин (вывод мочи катетером)',     duration: 30, price: 2400,  doctor_ids: UROLOG_DOCS,  lpu_id: 101 },
  { id: '5206', category_id: 3, name: 'Катетеризация мочевого пузыря у женщин (вывод мочи катетером)',     duration: 30, price: 2200,  doctor_ids: UROLOG_DOCS,  lpu_id: 101 },
  { id: '5207', category_id: 3, name: 'Урофлоурометрия (измерение скорости потока мочи)',                  duration: 20, price: 1500,  doctor_ids: UROLOG_DOCS,  lpu_id: 101 },
  { id: '5208', category_id: 3, name: 'Консультация уролога',                                              duration: 30, price: 2400,  doctor_ids: UROLOG_DOCS,  lpu_id: 101 },

  // ── ЛОР (cat 4) ─────────────────────────────────────────────────────────────
  { id: '5301', category_id: 4, name: 'Удаление серных пробок (1 ухо)',                                    duration: 20, price: 1200,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5302', category_id: 4, name: 'Вакуумное промывание миндалин аппаратом Тонзилор-М',                duration: 30, price: 2400,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5303', category_id: 4, name: 'Парацентез барабанной перепонки',                                   duration: 30, price: 3200,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5304', category_id: 4, name: 'Профилактический осмотр перед процедурой, с анемизацией',           duration: 20, price: 1100,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5305', category_id: 4, name: 'Ультразвуковая дезинтеграция нижних носовых раковин (конхоплексия) 2 кат. сложности', duration: 60, price: 8500, doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5306', category_id: 4, name: 'Пункция гайморовой пазухи с промыванием',                           duration: 30, price: 3500,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5307', category_id: 4, name: 'Эндоскопия ЛОР-органов',                                            duration: 30, price: 2800,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5308', category_id: 4, name: 'Биопсия опухолей уха',                                              duration: 30, price: 3800,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5309', category_id: 4, name: 'Анемизация носовых ходов',                                          duration: 15, price: 900,   doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5310', category_id: 4, name: 'Биопсия полости носа',                                              duration: 30, price: 3200,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5311', category_id: 4, name: 'Коагуляция кровеносных сосудов Лор-органов',                        duration: 30, price: 3000,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5312', category_id: 4, name: 'Биопсия гортани',                                                   duration: 30, price: 3500,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5313', category_id: 4, name: 'Вправление носа (репозиция костей носа) 1 кат. сложности',          duration: 30, price: 4500,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5314', category_id: 4, name: 'Вскрытие фурункула наружного слухового прохода',                    duration: 30, price: 2800,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5315', category_id: 4, name: 'Вправление носа (репозиция костей носа) 2 кат. сложности',          duration: 45, price: 6500,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5316', category_id: 4, name: 'Вскрытие отогематом',                                               duration: 30, price: 2500,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5317', category_id: 4, name: 'Носовой душ',                                                       duration: 15, price: 700,   doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5318', category_id: 4, name: 'Вскрытие паратонзиллярного абсцесса',                               duration: 30, price: 4200,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5319', category_id: 4, name: 'Гальваноакустика кровоточащих сосудов в полости носа',              duration: 30, price: 2200,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5320', category_id: 4, name: 'Полипэктомия уха, носа',                                            duration: 45, price: 5500,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5321', category_id: 4, name: 'Рассечение синехий в полости носа',                                 duration: 30, price: 3800,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5322', category_id: 4, name: 'Удаление атером в области лица 1 категории сложности',              duration: 30, price: 3500,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5323', category_id: 4, name: 'Удаление атером в области лица 2 категории сложности',              duration: 45, price: 5500,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5324', category_id: 4, name: 'Удаление атером в области лица 3 категории сложности',              duration: 60, price: 7500,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5325', category_id: 4, name: 'Удаление доброкачественной папилломы небной миндалины',             duration: 30, price: 3200,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5326', category_id: 4, name: 'Ультразвуковая дезинтеграция нижних носовых раковин (конхоплексия) 1 кат. сложности', duration: 45, price: 6500, doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5327', category_id: 4, name: 'Промывание околоносовых пазух и носа методом вакуумного перемещения (кукушка) с антибиотиком', duration: 30, price: 2200, doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5328', category_id: 4, name: 'Вскрытие атеромы ушного канала',                                    duration: 30, price: 2800,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5329', category_id: 4, name: 'Удаление инородного тела (одна зона) III к/с',                      duration: 45, price: 5500,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5330', category_id: 4, name: 'Удаление инородного тела (одна зона) II к/с',                       duration: 30, price: 3800,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5331', category_id: 4, name: 'Удаление инородного тела (одна зона) I к/с',                        duration: 20, price: 2400,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5332', category_id: 4, name: 'Турунда с лекарственным средством (одно ухо)',                      duration: 15, price: 600,   doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5333', category_id: 4, name: 'Вскрытие кисты небной миндалины',                                   duration: 30, price: 3500,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5334', category_id: 4, name: 'Туалет слухового прохода',                                          duration: 15, price: 800,   doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5335', category_id: 4, name: 'Внутригортанные вливания',                                          duration: 20, price: 1200,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5336', category_id: 4, name: 'Продувание слуховых труб',                                          duration: 15, price: 1000,  doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5337', category_id: 4, name: 'Промывание верхнечелюстных пазух через дренажи (1 трубка) физ. р-ром', duration: 20, price: 1400, doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5338', category_id: 4, name: 'Промывание околоносовых пазух и носа методом вакуумного перемещения (кукушка)', duration: 30, price: 1800, doctor_ids: LOR_DOCS, lpu_id: 101 },
  { id: '5339', category_id: 4, name: 'Консультация ЛОРа',                                                 duration: 30, price: 2100,  doctor_ids: LOR_DOCS, lpu_id: 101 },

  // ── Гинекология (cat 5) ─────────────────────────────────────────────────────
  { id: '5401', category_id: 5, name: 'Консультация гинеколога',                                           duration: 30, price: 2400,  doctor_ids: GYN_DOCS, lpu_id: 101 },
  { id: '5402', category_id: 5, name: 'Кольпоскопия',                                                      duration: 30, price: 2800,  doctor_ids: GYN_DOCS, lpu_id: 101 },
  { id: '5403', category_id: 5, name: 'Расширенная кольпоскопия',                                          duration: 45, price: 3800,  doctor_ids: GYN_DOCS, lpu_id: 101 },
  { id: '5404', category_id: 5, name: 'Установка внутриматочной спирали (ВМС)',                            duration: 45, price: 4500,  doctor_ids: GYN_DOCS, lpu_id: 101 },
  { id: '5405', category_id: 5, name: 'Удаление внутриматочной спирали (ВМС)',                             duration: 30, price: 2200,  doctor_ids: GYN_DOCS, lpu_id: 101 },
  { id: '5406', category_id: 5, name: 'Забор мазка на онкоцитологию',                                      duration: 15, price: 900,   doctor_ids: GYN_DOCS, lpu_id: 101 },
  { id: '5407', category_id: 5, name: 'Биопсия шейки матки',                                               duration: 30, price: 3500,  doctor_ids: GYN_DOCS, lpu_id: 101 },
  { id: '5408', category_id: 5, name: 'Радиоволновое лечение эрозии шейки матки',                          duration: 45, price: 7800,  doctor_ids: GYN_DOCS, lpu_id: 101 },
  { id: '5409', category_id: 5, name: 'Удаление полипов шейки матки',                                      duration: 45, price: 5500,  doctor_ids: GYN_DOCS, lpu_id: 101 },
  { id: '5410', category_id: 5, name: 'Удаление кондилом',                                                 duration: 30, price: 3200,  doctor_ids: GYN_DOCS, lpu_id: 101 },
  { id: '5411', category_id: 5, name: 'Ведение беременности (триместр)',                                   duration: 60, price: 15000, doctor_ids: GYN_DOCS, lpu_id: 101 },
  { id: '5412', category_id: 5, name: 'Прерывание беременности медикаментозное',                           duration: 60, price: 9500,  doctor_ids: GYN_DOCS, lpu_id: 101 },

  // ── Проктология (cat 6) ─────────────────────────────────────────────────────
  { id: '5501', category_id: 6, name: 'Консультация проктолога',                                           duration: 30, price: 2500,  doctor_ids: PROCT_DOCS, lpu_id: 101 },
  { id: '5502', category_id: 6, name: 'Аноскопия',                                                         duration: 20, price: 1800,  doctor_ids: PROCT_DOCS, lpu_id: 101 },
  { id: '5503', category_id: 6, name: 'Ректороманоскопия',                                                 duration: 30, price: 3200,  doctor_ids: PROCT_DOCS, lpu_id: 101 },
  { id: '5504', category_id: 6, name: 'Лигирование геморроидальных узлов латексными кольцами',             duration: 45, price: 6500,  doctor_ids: PROCT_DOCS, lpu_id: 101 },
  { id: '5505', category_id: 6, name: 'Склеротерапия геморроидальных узлов',                               duration: 45, price: 5500,  doctor_ids: PROCT_DOCS, lpu_id: 101 },
  { id: '5506', category_id: 6, name: 'Иссечение анальной трещины',                                        duration: 60, price: 12500, doctor_ids: PROCT_DOCS, lpu_id: 101 },
  { id: '5507', category_id: 6, name: 'Удаление перианальных кондилом',                                    duration: 30, price: 4200,  doctor_ids: PROCT_DOCS, lpu_id: 101 },

  // ── Гастроэнтерология (cat 7) ───────────────────────────────────────────────
  { id: '5601', category_id: 7, name: 'Консультация гастроэнтеролога',                                     duration: 30, price: 2300,  doctor_ids: GASTRO_DOCS, lpu_id: 101 },
  { id: '5602', category_id: 7, name: 'Гастроскопия (ФГДС)',                                               duration: 30, price: 4500,  doctor_ids: GASTRO_DOCS, lpu_id: 101 },
  { id: '5603', category_id: 7, name: 'Гастроскопия с биопсией',                                           duration: 45, price: 6200,  doctor_ids: GASTRO_DOCS, lpu_id: 101 },
  { id: '5604', category_id: 7, name: 'Дыхательный тест на Helicobacter pylori',                           duration: 30, price: 2400,  doctor_ids: GASTRO_DOCS, lpu_id: 101 },
  { id: '5605', category_id: 7, name: 'Колоноскопия',                                                      duration: 45, price: 7800,  doctor_ids: GASTRO_DOCS, lpu_id: 101 },

  // ── Травматология-ортопедия (cat 8) ─────────────────────────────────────────
  { id: '5701', category_id: 8, name: 'Консультация травматолога-ортопеда',                                duration: 30, price: 2600,  doctor_ids: TRAUMA_DOCS, lpu_id: 101 },
  { id: '5702', category_id: 8, name: 'Внутрисуставная инъекция',                                          duration: 20, price: 3500,  doctor_ids: TRAUMA_DOCS, lpu_id: 101 },
  { id: '5703', category_id: 8, name: 'Блокада лекарственная (одна область)',                              duration: 30, price: 2800,  doctor_ids: TRAUMA_DOCS, lpu_id: 101 },
  { id: '5704', category_id: 8, name: 'Гипсовая иммобилизация (одна конечность)',                          duration: 30, price: 2400,  doctor_ids: TRAUMA_DOCS, lpu_id: 101 },
  { id: '5705', category_id: 8, name: 'Пункция сустава',                                                   duration: 30, price: 2800,  doctor_ids: TRAUMA_DOCS, lpu_id: 101 },

  // ── Аллергология (cat 9) ────────────────────────────────────────────────────
  { id: '5801', category_id: 9, name: 'Консультация аллерголога',                                          duration: 30, price: 2200,  doctor_ids: ALLERG_DOCS, lpu_id: 101 },
  { id: '5802', category_id: 9, name: 'Кожные prick-тесты на аллергены (1 панель)',                        duration: 45, price: 3500,  doctor_ids: ALLERG_DOCS, lpu_id: 101 },
  { id: '5803', category_id: 9, name: 'АСИТ — аллерген-специфическая иммунотерапия (1 инъекция)',          duration: 20, price: 1800,  doctor_ids: ALLERG_DOCS, lpu_id: 101 },

  // ── Неврология (cat 10) ─────────────────────────────────────────────────────
  { id: '5901', category_id: 10, name: 'Консультация невролога',                                           duration: 30, price: 2200,  doctor_ids: NEUR_DOCS, lpu_id: 101 },
  { id: '5902', category_id: 10, name: 'Электронейромиография (ЭНМГ) — 1 нерв',                            duration: 30, price: 2800,  doctor_ids: NEUR_DOCS, lpu_id: 101 },
  { id: '5903', category_id: 10, name: 'Электроэнцефалография (ЭЭГ)',                                      duration: 45, price: 3400,  doctor_ids: NEUR_DOCS, lpu_id: 101 },
  { id: '5904', category_id: 10, name: 'Паравертебральная блокада',                                        duration: 30, price: 3200,  doctor_ids: NEUR_DOCS, lpu_id: 101 },

  // ── Эндокринология (cat 11) ─────────────────────────────────────────────────
  { id: '6001', category_id: 11, name: 'Консультация эндокринолога',                                       duration: 30, price: 2400,  doctor_ids: ENDO_DOCS, lpu_id: 101 },
  { id: '6002', category_id: 11, name: 'Подбор инсулинотерапии',                                           duration: 60, price: 4500,  doctor_ids: ENDO_DOCS, lpu_id: 101 },
];
