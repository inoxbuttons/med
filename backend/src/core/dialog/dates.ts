import { Slot, SlotMode } from '../domain';
import { FrameEntities } from '../nlu/frame';
import { nextWeekdayDate, toDateStr } from '../../integrations/shared/date-utils';

const DOW_RU: Record<string, string> = {
  mon: 'понедельник', tue: 'вторник', wed: 'среда', thu: 'четверг', fri: 'пятница', sat: 'суббота', sun: 'воскресенье',
};

/** Ограничения по дате → запрос слотов: конкретный день (mode=day) или ближайшие (nearest). */
export function slotWindow(e: FrameEntities, now = new Date()): { mode: SlotMode; date?: string } {
  const date = targetDate(e, now);
  if (date) return { mode: 'day', date };
  // «на следующей неделе» без дня — с понедельника следующей недели.
  if (e.nextWeek) return { mode: 'week', date: nextWeekdayDate('понедельник', 1, now) ?? undefined };
  return { mode: 'nearest' };
}

export function targetDate(e: FrameEntities, now = new Date()): string | undefined {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (e.date) return e.date;
  if (e.now) return toDateStr(today);
  if (e.relativeDay) {
    const add = { today: 0, tomorrow: 1, day_after_tomorrow: 2 }[e.relativeDay];
    return toDateStr(addDays(today, add));
  }
  if (e.dayOfWeek) {
    // Та же арифметика, что у старого движка (nextWeekdayDate), — даты совпадают.
    return nextWeekdayDate(DOW_RU[e.dayOfWeek], e.nextWeek ? 1 : 0, now) ?? undefined;
  }
  return undefined;
}

/** Фильтр по времени суток и «сейчас» (не раньше текущего часа). */
export function filterSlots(slots: Slot[], e: FrameEntities, now = new Date()): Slot[] {
  let out = slots;
  if (e.timeOfDay) {
    const [from, to] = { morning: ['00:00', '12:00'], afternoon: ['12:00', '16:00'], evening: ['16:00', '23:59'] }[e.timeOfDay];
    out = out.filter((s) => s.time >= from && s.time < to);
  }
  if (e.now) {
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    out = out.filter((s) => s.date > toDateStr(now) || s.time >= hhmm);
  }
  return out;
}

/** Слот точно в названное время или ближайшие к нему (до 3). */
export function byTime(slots: Slot[], time: string): { exact: Slot | null; near: Slot[] } {
  const exact = slots.find((s) => s.time === time) ?? null;
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const near = [...slots].sort((a, b) => Math.abs(minutes(a.time) - minutes(time)) - Math.abs(minutes(b.time) - minutes(time))).slice(0, 3);
  return { exact, near: near.sort((a, b) => a.start.localeCompare(b.start)) };
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
