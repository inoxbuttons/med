import { Appointment, Slot, VisitService } from '../domain';
import { ClinicProfile } from '../profile/clinic-profile';
import { Option, Target } from './dialog-state';

export interface QuickReply {
  label: string;
  /** Что уйдёт в движок при нажатии (вместо label): "choice:2", "yes", "no". */
  payload?: string;
}

export interface Reply {
  text: string;
  quickReplies?: QuickReply[];
}

/** Тексты по умолчанию. Профиль сети переопределяет их в `templates`. {{var}} — подстановки. */
export const DEFAULT_TEMPLATES: Record<string, string> = {
  greeting: 'Здравствуйте! Я ассистент {{clinicName}}. Помогу записаться к врачу или на исследование, подскажу расписание и цены. Что Вас интересует?',
  thanks: 'Пожалуйста! Если понадобится что-то ещё — пишите.',
  askTarget: 'К какому врачу или на какую услугу Вы хотите записаться?',
  notFound: 'Не нашла «{{query}}» в нашем каталоге. Уточните, пожалуйста, название или опишите, что беспокоит, — подскажу специалиста.',
  chooseTarget: 'Уточните, пожалуйста, что именно Вам нужно:',
  chooseArea: 'Какую область нужно обследовать?',
  chooseSlot: 'Свободное время:',
  chooseSlotFor: 'Свободное время — {{who}}:',
  noSlotsDay: 'На {{day}} свободного времени нет.',
  noSlotsDayAt: 'На {{day}} в клинике «{{clinic}}» свободного времени нет.',
  noSlotsAt: 'В клинике «{{clinic}}» свободного времени в ближайшие дни нет. Есть время в других клиниках.',
  clinicNotFound: 'Не нашла клинику «{{clinic}}». Наши клиники: {{list}}. Показываю время во всех.',
  clinicHasTime: 'Да, в клинике «{{clinic}}» есть свободное время.',
  noSlots: 'К сожалению, свободного времени в ближайшие две недели нет. Оставьте заявку — администратор подберёт время.',
  timeTaken: 'В {{time}} уже занято. Ближайшее свободное время:',
  askVisitType: 'Это первичный или повторный приём?',
  askPatientData: 'Для записи напишите, пожалуйста, одним сообщением: ФИО, телефон и дату рождения.',
  askPatientDataRest: 'Спасибо! Напишите, пожалуйста, ещё {{fields}}.',
  needLogin: 'Чтобы посмотреть или изменить свои записи, войдите в личный кабинет на сайте клиники.',
  confirmBooking: 'Проверьте, пожалуйста:\n{{summary}}\n\nПодтверждаете запись?',
  booked: 'Готово, Вы записаны!\n{{summary}}',
  bookFailed: 'Не получилось записать: {{reason}}',
  conflict: 'У Вас уже есть запись на это время: {{description}}. Заменить её новой или оставить обе?',
  askReferral: 'Для «{{service}}» нужно направление врача. Оно у Вас есть?',
  noReferral: 'Без направления на «{{service}}» записаться нельзя — его выписывает лечащий врач. Записать Вас на приём ({{direction}})?',
  atDoctorVisit: '«{{service}}» выполняется на приёме у врача. Запишу Вас к специалисту — он проведёт процедуру во время консультации.',
  operatorRequest: 'Ваша заявка на «{{service}}» принята. Администратор свяжется с Вами в ближайшее время.',
  referralByPhone: 'Запись на «{{service}}» по направлению — по телефону клиники.',
  noAppointments: 'Предстоящих записей не нашла.',
  appointmentsList: 'Ваши предстоящие записи:',
  chooseAppointment: 'Какую запись?',
  confirmCancel: 'Отменить запись: {{summary}}?',
  cancelled: 'Запись отменена.',
  cancelFailed: 'Не получилось отменить запись: {{reason}}',
  rescheduleWhen: 'На какое время перенести запись {{summary}}?',
  confirmReschedule: 'Перенести запись {{old}} на {{new}}?',
  rescheduled: 'Готово, запись перенесена.\n{{summary}}',
  offerBooking: 'Записать Вас?',
  preparationUnknown: 'Как подготовиться к {{what}}, подскажет администратор клиники:',
  walkInYes: 'Можно прийти и без записи, но по записи ждать не придётся.',
  walkInNo: 'Приём только по записи.',
  walkInUnknown: 'Возможность приёма без записи лучше уточнить по телефону клиники.',
  hoursUnknown: 'Часы работы лучше уточнить по телефону клиники.',
  addresses: 'Наши клиники:',
  emergencyNote: '',
  fallback: 'Я помогаю с записью в клинику, расписанием и ценами. Чем могу помочь?',
};

export class Templates {
  constructor(private readonly profile: ClinicProfile) {}

  t(key: keyof typeof DEFAULT_TEMPLATES | string, vars: Record<string, string | number> = {}): string {
    const tpl = this.profile.templates[key] ?? DEFAULT_TEMPLATES[key] ?? key;
    const all: Record<string, string | number> = { clinicName: this.profile.displayName || 'клиники', ...vars };
    return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => String(all[k] ?? ''));
  }
}

export function slotLabel(s: Slot, withDoctor = false, withClinic = false): string {
  const who = withDoctor && s.doctorName ? `${shortName(s.doctorName)}, ` : '';
  const where = withClinic ? ` (${s.clinicName})` : '';
  return `${who}${s.dateLabel} ${s.time}${where}`;
}

export function shortName(full: string): string {
  const [last, first, second] = full.split(/\s+/);
  return [last, first ? `${first[0]}.` : '', second ? `${second[0]}.` : ''].join(' ').replace(/\s+/g, ' ').trim();
}

export function targetLabel(t: Target): string {
  if (t.kind === 'doctor') return t.speciality ? `${t.name} (${t.speciality})` : t.name;
  if (t.kind === 'speciality') return t.title;
  return shortServiceName(t.name);
}

/** «МРТ ГОЛОВНОГО МОЗГА (исследование структуры …)» → «МРТ ГОЛОВНОГО МОЗГА» для списков и кнопок. */
export function shortServiceName(name: string): string {
  if (name.length <= 60) return name;
  const cut = name.search(/\s*\(/);
  return cut > 10 ? name.slice(0, cut) : `${name.slice(0, 58)}…`;
}

export function appointmentLabel(a: Appointment): string {
  const what = a.kind === 'service' ? a.serviceName : [a.speciality, a.doctorName].filter(Boolean).join(', ');
  return `${formatDate(a.date)} ${a.time} — ${what || 'приём'}, ${a.clinicName}`;
}

export function visitLabel(v: VisitService, showPrice: boolean): string {
  const kind = /повтор/i.test(v.name) ? 'Повторный' : /первич/i.test(v.name) ? 'Первичный' : v.name;
  return showPrice && v.price ? `${kind} — ${v.priceFrom ? 'от ' : ''}${v.price} ₽` : kind;
}

export function numbered(options: Option[]): string {
  return options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
}

export function choiceButtons(options: Option[], max = 8): QuickReply[] {
  return options.slice(0, max).map((o, i) => ({ label: o.label.length > 40 ? `${o.label.slice(0, 38)}…` : o.label, payload: `choice:${i + 1}` }));
}

export const YES_NO: QuickReply[] = [
  { label: 'Да', payload: 'yes' },
  { label: 'Нет', payload: 'no' },
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d} ${months[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
}
