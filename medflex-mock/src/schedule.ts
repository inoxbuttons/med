/**
 * Динамическая генерация расписания (свободных слотов).
 * Слоты генерируются из WorkingHours для каждого врача на запрошенный период,
 * минус уже занятые записи из store.
 */

import { DOCTORS, LPUS, WorkingHours } from './data';
import { getActiveAppointments } from './store';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function padTime(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Канонизирует dt_start к "YYYY-MM-DD HH:MM" для сравнения слотов:
 * принимает и "YYYY-MM-DD HH:MM[:SS]", и "YYYY-MM-DDTHH:MM[:SS]" — оба
 * формата встречаются в appointments.json (старые тестовые vs реальные).
 */
function normalizeDt(s: string): string {
  return s.replace('T', ' ').slice(0, 16);
}

/** Генерирует слоты на один день для данного расписания. */
function generateDaySlots(
  dateStr: string,
  wh: WorkingHours,
): Array<{ dt_start: string; dt_end: string }> {
  const slots: Array<{ dt_start: string; dt_end: string }> = [];
  const startM = toMinutes(wh.start);
  const endM = toMinutes(wh.end);

  for (let m = startM; m + wh.slotMin <= endM; m += wh.slotMin) {
    slots.push({
      dt_start: `${dateStr} ${padTime(m)}`,
      dt_end: `${dateStr} ${padTime(m + wh.slotMin)}`,
    });
  }
  return slots;
}

export interface LpuScheduleEntry {
  lpu_id: number;
  schedule: Array<{
    doctor_id: number;
    prices: Array<{ speciality_id: number; price: number | null }>;
    allowed_age: Array<{ speciality_id: number; min: number; max: number }>;
    cells: Array<{ dt_start: string; dt_end: string }>;
  }>;
}

/**
 * Строит расписание для набора клиник на заданный период.
 * Возвращает только свободные слоты (занятые исключаются).
 */
export function buildSchedule(params: {
  lpuIds: number[];
  dateStart: string; // YYYY-MM-DD
  days: number;
}): LpuScheduleEntry[] {
  const { lpuIds, dateStart, days } = params;
  const now = new Date();

  // Собираем набор занятых ключей: "doctorId_lpuId_<нормализованное dt_start>".
  // Нормализация обязательна — в данных встречаются оба формата (T-сепаратор и пробел).
  const booked = new Set(
    getActiveAppointments().map((a) => `${a.doctor_id}_${a.lpu_id}_${normalizeDt(a.dt_start)}`),
  );

  const result: LpuScheduleEntry[] = [];

  for (const lpuId of lpuIds) {
    const lpu = LPUS.find((l) => l.id === lpuId);
    if (!lpu || !lpu.direct_appointment_is_supported) continue;

    // Врачи этой клиники
    const lpuDoctors = DOCTORS.filter((d) => d.lpus.includes(lpuId));

    const doctorSchedules = lpuDoctors.map((doc) => {
      // Все workingHours этого врача для этой клиники (может быть несколько — например, Пн-Пт + Сб).
      const whs = doc.workingHours.filter((w) => w.lpu_id === lpuId);
      if (whs.length === 0) {
        return {
          doctor_id: doc.id,
          prices: doc.prices,
          allowed_age: [],
          cells: [],
        };
      }

      const cells: Array<{ dt_start: string; dt_end: string }> = [];

      for (let d = 0; d < days; d++) {
        const date = new Date(dateStart + 'T00:00:00');
        date.setDate(date.getDate() + d);
        const jsDay = date.getDay(); // 0=Sun..6=Sat
        const dbDay = jsDay === 0 ? 7 : jsDay; // 1=Mon..7=Sun

        // Берём первое подходящее окно для этого дня недели (если врач указал несколько).
        const wh = whs.find((w) => w.days.includes(dbDay));
        if (!wh) continue;

        const dateStr = toDateStr(date);
        const daySlots = generateDaySlots(dateStr, wh);

        for (const slot of daySlots) {
          // Фильтруем прошедшее время
          const slotDate = new Date(slot.dt_start.replace(' ', 'T'));
          if (slotDate <= now) continue;

          // Фильтруем занятые слоты (slot.dt_start уже в формате "YYYY-MM-DD HH:MM").
          const key = `${doc.id}_${lpuId}_${normalizeDt(slot.dt_start)}`;
          if (booked.has(key)) continue;

          cells.push(slot);
        }
      }

      return {
        doctor_id: doc.id,
        prices: doc.prices,
        allowed_age: [],
        cells,
      };
    });

    result.push({ lpu_id: lpuId, schedule: doctorSchedules });
  }

  return result;
}
