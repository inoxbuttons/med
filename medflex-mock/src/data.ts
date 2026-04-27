/**
 * Статические mock-данные: специальности, клиники, врачи с расписанием.
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

// ── Специальности ─────────────────────────────────────────────────────────────

export const SPECIALITIES: MfSpeciality[] = [
  { id: 1, name: 'Терапевт' },
  { id: 2, name: 'Кардиолог' },
  { id: 3, name: 'Невролог' },
  { id: 4, name: 'Хирург' },
  { id: 5, name: 'Офтальмолог' },
  { id: 6, name: 'Дерматолог' },
  { id: 7, name: 'Гинеколог' },
  { id: 8, name: 'Эндокринолог' },
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
    specialities: [1, 2, 3, 6, 7],
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
