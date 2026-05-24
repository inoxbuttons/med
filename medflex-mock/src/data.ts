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
    specialities: [1, 2, 3, 4, 5, 6, 7, 8],
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
    specialities: [1, 2, 3, 6, 7, 9, 10],
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
  // Сеть 1
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
    id: 1006,
    efio: 'Беляева Ольга Игоревна',
    // Косметолог. Услуги (биоармирование, ботокс, пилинг, …) — отдельная сущность SERVICES,
    // связаны с врачом через service.doctor_ids.
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
    id: 1008,
    efio: 'Соколов Игорь Викторович',
    // Врач УЗИ. Услуги (УЗИ сердца, ОБП, щитовидной железы…) в SERVICES.
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
];

// ── Категории услуг ───────────────────────────────────────────────────────────

export const SERVICE_CATEGORIES: MfServiceCategory[] = [
  { id: 1, name: 'Косметология' },
  { id: 2, name: 'УЗИ-диагностика' },
];

// ── Услуги ────────────────────────────────────────────────────────────────────
// Все услуги привязаны к клинике 102 (Клиника XXI Век на Мира).
// Цена едина в рамках клиники (в спеке — одно поле price на услугу).

export const SERVICES: MfService[] = [
  // Косметология (category_id: 1) — врачи 1006 (Беляева), 1007 (Морозова)
  { id: '5001', category_id: 1, name: 'Биоармирование',                                                    duration: 60, price: 35000, doctor_ids: [1006],       lpu_id: 102 },
  { id: '5002', category_id: 1, name: 'Введение филлеров (коррекция форм)',                                 duration: 60, price: 25000, doctor_ids: [1006],       lpu_id: 102 },
  { id: '5003', category_id: 1, name: 'Внутримышечное введение ботулотоксина (ботокс)',                     duration: 30, price: 11500, doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5004', category_id: 1, name: 'Внутри/подкожное введение лекарственного препарата',                 duration: 30, price: 1500,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5005', category_id: 1, name: 'Внутри/подкожное введение лекарственного препарата (гл. врач)',      duration: 30, price: 2500,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5006', category_id: 1, name: 'Дарсонвализация',                                                    duration: 30, price: 1200,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5007', category_id: 1, name: 'Дерматологический пилинг',                                           duration: 60, price: 4200,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5008', category_id: 1, name: 'Игольчатый RF-лифтинг МОРФЕУС8',                                     duration: 90, price: 35000, doctor_ids: [1006],       lpu_id: 102 },
  { id: '5009', category_id: 1, name: 'Консультация косметолога',                                           duration: 30, price: 1900,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5010', category_id: 1, name: 'Коррекция бровей и ресниц',                                          duration: 30, price: 1500,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5011', category_id: 1, name: 'Косметика Angiopharm',                                               duration: 60, price: 5500,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5012', category_id: 1, name: 'Лазерная эпиляция',                                                  duration: 60, price: 5000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5013', category_id: 1, name: 'Липолиз',                                                            duration: 60, price: 6000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5014', category_id: 1, name: 'Массаж лица медицинский',                                            duration: 30, price: 3500,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5015', category_id: 1, name: 'Микротоковое воздействие при заболеваниях кожи и ПЖК',               duration: 30, price: 2800,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5016', category_id: 1, name: 'Оздоровительно-профилактический массаж тела',                        duration: 60, price: 4000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5017', category_id: 1, name: 'Пакет Массаж миофасцеальный 60 мин',                                 duration: 60, price: 5000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5018', category_id: 1, name: 'Пирсинг',                                                            duration: 30, price: 2400,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5019', category_id: 1, name: 'Плазмолифтинг',                                                      duration: 60, price: 7800,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5020', category_id: 1, name: 'Уходы за лицом',                                                     duration: 60, price: 4500,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5021', category_id: 1, name: 'Фотоомоложение IPL терапия (Lumecca)',                               duration: 60, price: 12000, doctor_ids: [1006],       lpu_id: 102 },
  { id: '5022', category_id: 1, name: 'Фототерапия IPL терапия (Lumecca): сосуды',                          duration: 30, price: 9000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5023', category_id: 1, name: 'Фототерапия IPL терапия (Lumecca): удаление пигмента',               duration: 30, price: 9000,  doctor_ids: [1006],       lpu_id: 102 },
  { id: '5024', category_id: 1, name: 'Холодная плазма',                                                    duration: 30, price: 6200,  doctor_ids: [1006, 1007], lpu_id: 102 },
  { id: '5025', category_id: 1, name: 'Чистка лица',                                                        duration: 60, price: 3400,  doctor_ids: [1006, 1007], lpu_id: 102 },

  // УЗИ (category_id: 2) — врач 1008 (Соколов)
  { id: '5101', category_id: 2, name: 'УЗИ сердца',                                                         duration: 30, price: 3500,  doctor_ids: [1008],       lpu_id: 102 },
  { id: '5102', category_id: 2, name: 'УЗИ органов брюшной полости',                                        duration: 45, price: 3000,  doctor_ids: [1008],       lpu_id: 102 },
  { id: '5103', category_id: 2, name: 'УЗИ щитовидной железы',                                              duration: 20, price: 2500,  doctor_ids: [1008],       lpu_id: 102 },
  { id: '5104', category_id: 2, name: 'УЗИ почек',                                                          duration: 20, price: 2500,  doctor_ids: [1008],       lpu_id: 102 },
  { id: '5105', category_id: 2, name: 'УЗИ мочевого пузыря',                                                duration: 15, price: 2200,  doctor_ids: [1008],       lpu_id: 102 },
];
