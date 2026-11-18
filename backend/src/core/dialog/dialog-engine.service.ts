import { Injectable, Logger } from '@nestjs/common';
import { Appointment, PatientData, PatientIdentity, Slot, VisitService } from '../domain';
import { BookingPort, CatalogSourcePort, MisKind } from '../ports';
import { Frame, FrameEntities } from '../nlu/frame';
import { NluResult } from '../nlu/nlu.service';
import { Expectation, yesNo } from '../nlu/rule-parser';
import { ClinicProfile } from '../profile/clinic-profile';
import { LlmUsage } from '../../llm/llm.types';
import { parseFlexibleDate } from '../../integrations/shared/date-utils';
import { normalizeRuPhone } from '../../integrations/shared/phone-utils';
import { AnswerResult } from './answer.service';
import { byTime, filterSlots, slotWindow } from './dates';
import { DialogSession, DialogState, emptyState, invalidate, Option, summarize, Target } from './dialog-state';
import { EMERGENCY_REPLY, isEmergencyMessage, isPromptInjection } from './guards';
import {
  appointmentLabel, choiceButtons, numbered, QuickReply, Reply, shortName, slotLabel, targetLabel, Templates, visitLabel, YES_NO,
} from './render';
import { CatalogLookup, resolveTarget } from './target-resolver';
import { normalize, sameStem, words } from '../catalog/text';
import { relevantHits, SearchHit } from '../catalog/catalog-search.service';

/** Зависимости движка — интерфейсы, чтобы сценарии тестировались без БД и модели. */
export interface EngineDeps {
  nlu: { parse(text: string, ctx: any): Promise<NluResult> };
  answers: {
    answer(q: string, facts: string, ctx: any): Promise<AnswerResult>;
    symptoms(complaint: string, speciality: string, ctx: any): Promise<AnswerResult>;
    agent(q: string, catalog: CatalogSourcePort, ctx: any): Promise<AnswerResult>;
  };
  search: CatalogLookup;
  adapters(clinicNetId: number, opts: { townId?: number }): Promise<{ mis: MisKind; booking: BookingPort; catalog: CatalogSourcePort }>;
  profile(clinicNetId: number): ClinicProfile;
  onUsage?(session: DialogSession, task: string, usage: LlmUsage, promptHash?: string): void;
  now?(): Date;
}

/** Данные одного хода. */
interface Turn {
  session: DialogSession;
  state: DialogState;
  text: string;
  frame: Frame;
  profile: ClinicProfile;
  T: Templates;
  mis: MisKind;
  booking: BookingPort;
  catalog: CatalogSourcePort;
  /** Тексты, накопленные за ход (симптомы, «нет в этот день» и т. п.). */
  prefix: string[];
  /** Нажатая кнопка, если была. */
  payload?: string;
}

const MAX_DOCTORS_FOR_SLOTS = 10;
const MAX_SLOT_OPTIONS = 8;

/**
 * Движок диалога (docs/architecture/04-dialog-model.md): реплика → фрейм → требования цели
 * закрываются по порядку; модель вызывается только для разбора реплики и свободных ответов.
 */
@Injectable()
export class DialogEngine {
  private readonly logger = new Logger(DialogEngine.name);

  constructor(private readonly deps: EngineDeps) {}

  async handle(session: DialogSession, input: { text: string; payload?: string }): Promise<Reply> {
    const text = (input.text ?? '').trim();
    const state = session.state;
    const profile = this.deps.profile(session.clinicNetId);
    const T = new Templates(profile);

    if (text && isPromptInjection(text)) return this.say(session, T.t('fallback'));
    if (text && isEmergencyMessage(text)) {
      session.state = emptyState();
      return this.say(session, EMERGENCY_REPLY);
    }

    const { mis, booking, catalog } = await this.deps.adapters(session.clinicNetId, { townId: session.townId });
    const frame = payloadFrame(input.payload) ?? (await this.understand(session, text, mis));
    session.messages.push({ role: 'user', content: text || input.payload || '' });

    const turn: Turn = { session, state, text, frame, profile, T, mis, booking, catalog, prefix: [], payload: input.payload };
    let reply: Reply;
    try {
      reply = await this.process(turn);
    } catch (err) {
      this.logger.error(`Сессия ${session.id}: ${String((err as Error)?.stack ?? err)}`);
      session.state = emptyState();
      reply = { text: 'Извините, не получилось обработать запрос. Попробуйте, пожалуйста, ещё раз или позвоните в клинику.' };
    }
    if (turn.prefix.length) reply = { ...reply, text: [...turn.prefix, reply.text].filter(Boolean).join('\n\n') };
    return this.say(session, reply.text, reply.quickReplies);
  }

  // ── Понимание ─────────────────────────────────────────────────────────────

  private async understand(session: DialogSession, text: string, mis: MisKind): Promise<Frame> {
    const lastAssistant = [...session.messages].reverse().find((m) => m.role === 'assistant')?.content;
    const recentUser = session.messages.filter((m) => m.role === 'user').slice(-2).map((m) => m.content);
    const res = await this.deps.nlu.parse(text, {
      clinicNetId: session.clinicNetId,
      mis,
      provider: session.provider,
      model: session.model,
      expectation: session.state.expectation,
      stateSummary: summarize(session.state),
      lastAssistant,
      recentUser,
      now: this.now(),
    });
    if (res.usage) this.deps.onUsage?.(session, 'nlu', res.usage, res.promptHash);
    return res.frame;
  }

  // ── Ход ───────────────────────────────────────────────────────────────────

  private async process(turn: Turn): Promise<Reply> {
    const { frame, state, T } = turn;
    if (frame.entities) frame.entities = await this.withoutRestatedSubject(turn, frame.entities);
    const exp = state.expectation;
    const shown = state.options;
    state.expectation = { kind: 'none' };
    state.options = [];

    // «да» при показанном списке — не выбор варианта (модель иногда возвращает choice: 1).
    if (frame.choice && exp.kind === 'choice' && /^\s*(да|ага|ок|окей|хорошо|давайте)[\s!.,]*$/i.test(turn.text)) frame.choice = undefined;

    // Данные пациента вместо выбора из списка — сохранить и попросить сначала выбрать.
    if (exp.kind === 'choice' && !frame.choice && !frame.goal && onlyPatientData(frame)) {
      this.mergeEntities(turn, frame.entities ?? {});
      state.expectation = exp;
      state.options = shown;
      return { text: `Спасибо, данные сохранила. Сначала выберите, пожалуйста, вариант:\n${numbered(shown)}`, quickReplies: choiceButtons(shown) };
    }

    // «нет» на список вариантов — не повторять список молча.
    if (frame.reply === 'no' && exp.kind === 'choice' && !frame.goal && !frame.choice && !hasConstraints(frame)) {
      state.expectation = exp;
      state.options = shown;
      return { text: 'Хорошо. Напишите, пожалуйста, что именно нужно, — или выберите вариант из списка выше.', quickReplies: choiceButtons(shown) };
    }

    // Выбор из списка, показанного на прошлом ходу
    if (frame.choice && shown[frame.choice - 1]) {
      const r = await this.applyOption(turn, shown[frame.choice - 1]);
      if (r) return r;
    }

    // «да»/«нет» без активного сценария (например, после завершённой записи) — не к агенту.
    if (!frame.goal && !state.goal && frame.reply && !hasConstraints(frame)) {
      return { text: frame.reply === 'no' ? turn.T.t('thanks') : 'Чем ещё могу помочь?' };
    }

    // Новая цель
    const goal = frame.goal ?? (state.goal ? undefined : inferGoal(frame));
    if (goal === 'smalltalk') {
      state.expectation = exp; // разговор не сбивает текущий шаг
      state.options = shown;
      return { text: /спасиб|благодар/i.test(turn.text) ? T.t('thanks') : T.t('greeting') };
    }
    if (goal === 'other') {
      // Посреди сценария непонятная реплика — не к агенту, а повторить текущий вопрос.
      if (state.goal && exp.kind !== 'none') {
        this.mergeEntities(turn, frame.entities ?? {});
        turn.prefix.push('Извините, не совсем поняла.');
        return this.advance(turn, exp);
      }
      state.expectation = exp;
      state.options = shown;
      return this.freeAnswer(turn);
    }
    if (goal && goal !== state.goal) {
      // Запись ↔ вопрос по тому же врачу/услуге («на четверг есть места?») — контекст не терять.
      const keep = (state.goal === 'info' && goal === 'book') || (state.goal === 'book' && goal === 'info');
      const fresh = emptyState();
      fresh.goal = goal;
      if (keep) {
        fresh.entities = state.entities;
        fresh.target = state.target;
        fresh.slot = state.slot;
      }
      turn.state = turn.session.state = fresh;
    }
    const s = turn.state;
    if (frame.next?.length) s.queue.push(...frame.next);

    this.mergeEntities(turn, frame.entities ?? {}, frame.edit);

    // Подтверждение записи/отмены/переноса — только явное «да» (кнопка или слово), не догадка модели.
    if (frame.reply === 'yes' && exp.kind === 'confirm' && turn.payload !== 'yes' && yesNo(turn.text) !== 'yes') {
      frame.reply = undefined;
    }

    // Ответ да/нет на ожидаемый вопрос
    if (frame.reply && (exp.kind === 'confirm' || exp.kind === 'yes_no')) {
      const r = await this.onReply(turn, exp, frame.reply);
      if (r) return r;
    }

    return this.advance(turn, exp);
  }

  /** Продвинуть текущую цель; по завершении — следующую из очереди. */
  private async advance(turn: Turn, exp: Expectation): Promise<Reply> {
    const s = turn.state;
    switch (s.goal) {
      case 'book':
        return this.book(turn);
      case 'info':
        return this.info(turn);
      case 'my_appointments':
        return this.myAppointments(turn);
      case 'cancel':
      case 'reschedule':
        return this.changeAppointment(turn);
      default:
        if (exp.kind !== 'none') s.expectation = exp;
        return this.freeAnswer(turn);
    }
  }

  /** Цель выполнена: следующая из очереди или пустое состояние. */
  private async finish(turn: Turn, reply: Reply): Promise<Reply> {
    const next = turn.state.queue.shift();
    const queue = turn.state.queue;
    turn.state = turn.session.state = emptyState();
    if (!next) return reply;
    turn.state.queue = queue;
    turn.state.goal = next.goal ?? null;
    this.mergeEntities(turn, next.entities ?? {});
    turn.prefix.push(reply.text);
    return this.advance(turn, { kind: 'none' });
  }

  /**
   * Модель часто повторяет из контекста уже выбранное («консультация флеболога» при выбранной
   * «Консультации врача-флеболога повторной», «узи щитовидки» при выбранном УЗИ щитовидной железы) —
   * это не новая цель, выбор не сбрасывать. Сначала сравнение слов, иначе — гибридный поиск:
   * если текущий выбор среди релевантной выдачи по названному, пациент говорит о том же.
   */
  private async withoutRestatedSubject(turn: Turn, e: FrameEntities): Promise<FrameEntities> {
    const s = turn.state;
    if (!s.target) return e;
    const known = chosenWords(s);
    const out = { ...e };
    for (const k of SUBJECT_KEYS) {
      const v = out[k];
      if (typeof v !== 'string' || !v.trim()) continue;
      if (restatesByWords(v, known)) { delete out[k]; continue; }
      try {
        const hits = await this.deps.search.search(turn.session.clinicNetId, v, { kinds: SUBJECT_KINDS[k], limit: 10 });
        if (relevantHits(hits).some((h) => hitIsChosen(h, s))) delete out[k];
      } catch (err) {
        this.logger.warn(`restated check: ${String(err)}`);
      }
    }
    return out;
  }

  private mergeEntities(turn: Turn, e: FrameEntities, edit?: string[]): void {
    const s = turn.state;
    const changed = Object.entries(e)
      .filter(([k, v]) => v !== undefined && (s.entities as Record<string, unknown>)[k] !== v)
      .map(([k]) => k);
    // Новый день отменяет старый способ задать день.
    if (changed.some((k) => ['date', 'dayOfWeek', 'relativeDay', 'now'].includes(k))) {
      for (const k of ['date', 'dayOfWeek', 'relativeDay', 'now', 'nextWeek'] as const) if (!(k in e)) delete s.entities[k];
    }
    if (changed.some((k) => ['doctorName', 'speciality', 'serviceQuery', 'symptom'].includes(k))) {
      for (const k of ['doctorName', 'speciality', 'serviceQuery', 'symptom'] as const) if (!(k in e)) delete s.entities[k];
    }
    invalidate(s, [...changed, ...(edit ?? [])]);
    Object.assign(s.entities, e);

    // Данные пациента — в сессию (переживают смену цели).
    const p = turn.session.patient ?? ({} as Partial<PatientData>);
    const pd: Partial<PatientData> = {
      ...p,
      ...(e.lastName ? { lastName: e.lastName } : {}),
      ...(e.firstName ? { firstName: e.firstName } : {}),
      ...(e.secondName ? { secondName: e.secondName } : {}),
      // Модель может вернуть «8 999 000-00-00» или «01.01.1990» — к единому формату.
      ...(e.phone ? { phone: normalizeRuPhone(e.phone) ?? e.phone } : {}),
      ...(e.birthday ? { birthday: parseFlexibleDate(e.birthday) ?? e.birthday } : {}),
    };
    if (Object.keys(pd).length) turn.session.patient = pd as PatientData;
  }

  private async applyOption(turn: Turn, o: Option): Promise<Reply | null> {
    const s = turn.state;
    switch (o.kind) {
      case 'target':
        s.target = o.target;
        return null;
      case 'area':
        if (o.targets.length === 1) {
          s.target = o.targets[0];
          return null;
        }
        return this.offer(turn, turn.T.t('chooseTarget'), o.targets.slice(0, MAX_SLOT_OPTIONS).map((t) => ({ kind: 'target', target: t, label: targetLabel(t) })));
      case 'slot':
        s.slot = o.slot;
        if (!s.goal || s.goal === 'info') s.goal = 'book';
        if (!s.target && o.slot.doctorId) s.target = { kind: 'doctor', doctorId: o.slot.doctorId, name: o.slot.doctorName ?? '' };
        return null;
      case 'appointment':
        s.appointment = o.appointment;
        return null;
      case 'visit':
        s.visit = o.visit;
        return null;
      case 'action':
        if (o.action === 'replace' && s.conflictRef) return this.replaceConflicting(turn);
        s.slot = undefined; // other_time
        s.conflictRef = undefined;
        return null;
    }
  }

  private async onReply(turn: Turn, exp: Expectation, reply: 'yes' | 'no'): Promise<Reply | null> {
    const s = turn.state;
    if (exp.kind === 'confirm') {
      if (reply === 'no') {
        if (s.goal === 'book') {
          s.slot = undefined;
          // В отказе уже есть новое пожелание по времени — сразу показать варианты.
          const e = turn.frame.entities ?? {};
          if (e.date || e.dayOfWeek || e.relativeDay || e.time || e.timeOfDay || e.nextWeek) return null;
          s.expectation = { kind: 'yes_no', field: 'proceed' };
          return { text: 'Хорошо, не записываю. Подобрать другое время?', quickReplies: YES_NO };
        }
        return this.finish(turn, { text: 'Хорошо, ничего не меняю.' });
      }
      if (s.goal === 'book') return this.doBook(turn);
      if (s.goal === 'cancel') return this.doCancel(turn);
      if (s.goal === 'reschedule') return this.doReschedule(turn);
      return null;
    }
    if (exp.kind === 'yes_no' && exp.field === 'hasReferral') {
      s.hasReferral = reply === 'yes';
      return null;
    }
    if (exp.kind === 'yes_no' && exp.field === 'proceed') {
      if (reply === 'no') return this.finish(turn, { text: turn.T.t('thanks') });
      s.goal = 'book';
      return null;
    }
    return null;
  }

  // ── Запись ────────────────────────────────────────────────────────────────

  private async book(turn: Turn): Promise<Reply> {
    const s = turn.state;
    const { T, profile, booking } = turn;

    // 1. Кого/что
    if (!s.target) {
      const r = await resolveTarget(s.entities, { clinicNetId: turn.session.clinicNetId, search: this.deps.search, profile });
      if (r.kind === 'missing') return { text: T.t('askTarget') };
      if (r.kind === 'none') return { text: T.t('notFound', { query: r.query }) };
      if (r.kind === 'choice') return this.offer(turn, T.t('chooseTarget'), r.targets.map((t) => ({ kind: 'target', target: t, label: targetLabel(t) })));
      if (r.kind === 'areas') return this.offer(turn, T.t('chooseArea'), r.areas.map((a) => ({ kind: 'area', targets: a.targets, aliases: a.aliases, label: a.label })));
      s.target = r.target;
      if (s.entities.symptom && !s.entities.speciality && r.target.kind === 'speciality') {
        const a = await this.deps.answers.symptoms(s.entities.symptom, r.target.title, this.answerCtx(turn));
        this.usage(turn, a);
        if (a.text) turn.prefix.push(a.text);
      }
    }

    // 2. Услуга: на приёме врача / по направлению
    if (s.target.kind === 'service') {
      const svc = s.target;
      if (svc.atDoctorVisit && svc.direction) {
        // Сама услуга — приём/консультация: пояснение «выполняется на приёме» лишнее.
        if (!/^(консультац|при[её]м|осмотр)/i.test(svc.name.trim())) turn.prefix.push(T.t('atDoctorVisit', { service: svc.name }));
        const r = await resolveTarget({ speciality: svc.direction, child: s.entities.child }, { clinicNetId: turn.session.clinicNetId, search: this.deps.search, profile });
        if (r.kind === 'single') s.target = r.target;
      } else if (!svc.selfBooking) {
        return this.referral(turn, svc);
      }
    }

    // 3. Время
    if (!s.slot) {
      const r = await this.pickSlot(turn);
      if (r) return r;
    }
    const slot = s.slot!;

    // 4. Тип приёма (первичный/повторный)
    const toDoctor = s.target!.kind !== 'service';
    if (toDoctor && s.visit === undefined && profile.features.visitTypeQuestion && booking.capabilities().visitServices && slot.doctorId) {
      const visits = await booking.visitServices(slot.doctorId, slot.clinicId);
      const primary = visits.find((v) => /первич/i.test(v.name));
      const repeat = visits.find((v) => /повтор/i.test(v.name));
      if (s.entities.visitType) s.visit = (s.entities.visitType === 'primary' ? primary : repeat) ?? null;
      else if (primary && repeat) {
        const showPrice = profile.features.showPrices === 'always';
        s.expectation = { kind: 'visit_type' };
        const options: Option[] = [primary, repeat].map((v) => ({ kind: 'visit', visit: v, label: visitLabel(v, showPrice) }));
        return this.offer(turn, T.t('askVisitType'), options, { kind: 'visit_type' });
      } else s.visit = primary ?? repeat ?? null;
    }

    // 5. Данные пациента
    const need = this.missingPatientFields(turn);
    if (need.length) {
      if (!booking.capabilities().guestBooking) return { text: T.t('needLogin') };
      s.expectation = { kind: 'patient_data', fields: need };
      return { text: this.askPatientData(turn, need) };
    }

    // 6. Подтверждение
    s.expectation = { kind: 'confirm' };
    return { text: T.t('confirmBooking', { summary: this.summary(turn) }), quickReplies: [{ label: 'Подтверждаю', payload: 'yes' }, { label: 'Нет', payload: 'no' }] };
  }

  private async pickSlot(turn: Turn): Promise<Reply | null> {
    const s = turn.state;
    const { T, booking } = turn;
    const now = this.now();
    const win: { mode: 'nearest' | 'day' | 'week'; date?: string } = slotWindow(s.entities, now);
    const load = async (mode: 'nearest' | 'day' | 'week', date?: string) => this.loadSlots(turn, mode, date);

    // Перенос «на другой день»: ближайшие дни после даты переносимой записи.
    if (s.excludeDate && win.mode === 'nearest') {
      win.mode = 'week';
      win.date = nextDay(s.excludeDate);
    }
    let slots = this.forAge(filterSlots(await load(win.mode, win.date), s.entities, now), s.entities.child);
    if (s.excludeDate) slots = slots.filter((sl) => sl.date !== s.excludeDate);
    slots = this.byClinic(slots, s.entities.clinic);

    if (s.entities.time && slots.length) {
      const { exact, near } = byTime(slots, s.entities.time);
      if (exact) {
        s.slot = exact;
        return null;
      }
      return this.offer(turn, T.t('timeTaken', { time: s.entities.time }), near.map((sl) => ({ kind: 'slot', slot: sl, label: slotLabel(sl, s.target?.kind === 'speciality') })));
    }

    if (slots.length === 0 && win.mode === 'day') {
      turn.prefix.push(T.t('noSlotsDay', { day: dayWord(s.entities, win.date!) }));
      slots = this.byClinic(this.forAge(filterSlots(await load('nearest'), { ...s.entities, now: undefined }, now), s.entities.child), s.entities.clinic);
    }
    if (slots.length === 0) {
      if (s.target?.kind === 'service') {
        // Нет расписания — заявка администратору.
        return this.operatorRequest(turn, s.target.name, 'Нет свободного времени в расписании');
      }
      return this.finish(turn, { text: T.t('noSlots') });
    }

    const perDoctor = s.target?.kind === 'speciality';
    const options = (perDoctor ? firstPerDoctor(slots) : slots).slice(0, MAX_SLOT_OPTIONS);
    const manyClinics = new Set(options.map((o) => o.clinicId)).size > 1;
    const who = s.target && s.target.kind !== 'speciality' ? targetLabel(s.target) : '';
    return this.offer(turn, who ? T.t('chooseSlotFor', { who }) : T.t('chooseSlot'), options.map((sl) => ({ kind: 'slot', slot: sl, label: slotLabel(sl, perDoctor, manyClinics) })));
  }

  private async loadSlots(turn: Turn, mode: 'nearest' | 'day' | 'week', date?: string): Promise<Slot[]> {
    const t = turn.state.target!;
    if (t.kind === 'doctor') return turn.booking.findSlots({ doctorId: t.doctorId, mode, date });
    if (t.kind === 'service') return turn.booking.findSlots({ serviceId: t.serviceId, mode, date });
    const lists = await Promise.all(
      t.doctorIds.slice(0, MAX_DOCTORS_FOR_SLOTS).map((doctorId) => turn.booking.findSlots({ doctorId, mode, date }).catch(() => [] as Slot[])),
    );
    return lists.flat().sort((a, b) => a.start.localeCompare(b.start));
  }

  /** Взрослому не предлагать детскую клинику (и наоборот), если есть другие варианты. */
  private forAge(slots: Slot[], child?: boolean): Slot[] {
    const kids = (s: Slot) => /детск/i.test(s.clinicName);
    const f = slots.filter((s) => (child ? kids(s) : !kids(s)));
    return f.length ? f : slots;
  }

  private byClinic(slots: Slot[], clinic?: string): Slot[] {
    if (!clinic) return slots;
    const stem = clinic.toLowerCase().replace(/ё/g, 'е').slice(0, Math.max(4, clinic.length - 2));
    const f = slots.filter((s) => s.clinicName.toLowerCase().replace(/ё/g, 'е').includes(stem));
    return f.length ? f : slots;
  }

  private async referral(turn: Turn, svc: Extract<Target, { kind: 'service' }>): Promise<Reply> {
    const s = turn.state;
    const { T, profile } = turn;
    if (s.hasReferral === undefined && s.entities.hasReferral !== undefined) s.hasReferral = s.entities.hasReferral;
    if (s.hasReferral === undefined) {
      s.expectation = { kind: 'yes_no', field: 'hasReferral' };
      return { text: T.t('askReferral', { service: svc.name }), quickReplies: YES_NO };
    }
    const flow = profile.features.referralFlow;
    if (s.hasReferral && flow === 'operator') return this.operatorRequest(turn, svc.name, 'Есть направление');
    if (s.hasReferral && flow === 'off') return this.finish(turn, { text: T.t('referralByPhone', { service: svc.name }) });
    // Нет направления (или flow=doctor) — предложить врача направления.
    const direction = svc.direction ?? 'терапевт';
    const r = await resolveTarget({ speciality: direction, child: s.entities.child }, { clinicNetId: turn.session.clinicNetId, search: this.deps.search, profile });
    if (r.kind !== 'single') return this.finish(turn, { text: T.t('referralByPhone', { service: svc.name }) });
    s.target = r.target;
    s.hasReferral = undefined;
    s.expectation = { kind: 'yes_no', field: 'proceed' };
    return { text: T.t('noReferral', { service: svc.name, direction: targetLabel(r.target) }), quickReplies: YES_NO };
  }

  private async operatorRequest(turn: Turn, serviceName: string, notes: string): Promise<Reply> {
    const s = turn.state;
    const need = this.missingPatientFields(turn);
    if (need.length) {
      s.expectation = { kind: 'patient_data', fields: need };
      return { text: turn.T.t('askPatientData') };
    }
    const t = s.target;
    await turn.booking.createOperatorRequest({
      serviceId: t?.kind === 'service' ? t.serviceId : undefined,
      doctorId: t?.kind === 'doctor' ? t.doctorId : undefined,
      patient: this.patient(turn),
      notes: `${notes}. ${serviceName}`,
      sessionId: turn.session.id,
    });
    return this.finish(turn, { text: turn.T.t('operatorRequest', { service: serviceName }) });
  }

  private async doBook(turn: Turn): Promise<Reply> {
    const s = turn.state;
    const slot = s.slot;
    if (!slot || !s.target) return this.book(turn);
    const res = await turn.booking.book({
      slot,
      doctorId: s.target.kind === 'service' ? undefined : slot.doctorId,
      serviceId: s.target.kind === 'service' ? s.target.serviceId : undefined,
      visitServiceId: s.visit?.id,
      patient: this.patient(turn),
    });
    if (res.status === 'booked') return this.finish(turn, { text: turn.T.t('booked', { summary: this.summary(turn) }) });
    if (res.status === 'conflict') {
      s.conflictRef = res.existingRef;
      const options: Option[] = [
        ...(res.existingRef ? [{ kind: 'action' as const, action: 'replace' as const, label: 'Заменить старую запись' }] : []),
        { kind: 'action', action: 'other_time', label: 'Выбрать другое время' },
      ];
      return this.offer(turn, turn.T.t('conflict', { description: res.description ?? 'запись на это время' }), options);
    }
    if (res.reason === 'patient_data_required') {
      s.expectation = { kind: 'patient_data', fields: ['fullName', 'phone', 'birthday'] };
      return { text: turn.T.t('askPatientData') };
    }
    if (res.reason === 'slot_taken' || res.reason === 'past_time') {
      s.slot = undefined;
      turn.prefix.push(res.message);
      return this.book(turn);
    }
    return this.finish(turn, { text: turn.T.t('bookFailed', { reason: res.message }) });
  }

  private async replaceConflicting(turn: Turn): Promise<Reply> {
    const s = turn.state;
    const ref = s.conflictRef!;
    const cancelled = await turn.booking.cancel(ref, this.patient(turn));
    s.conflictRef = undefined;
    if (!cancelled.success) return this.finish(turn, { text: turn.T.t('cancelFailed', { reason: cancelled.message }) });
    return this.doBook(turn);
  }

  // ── Вопросы ───────────────────────────────────────────────────────────────

  private async info(turn: Turn): Promise<Reply> {
    const s = turn.state;
    const { T, profile } = turn;
    const q = turn.frame.question ?? (s.entities.serviceQuery ? 'has_service' : s.entities.doctorName ? 'schedule' : 'other');
    // «Болит голова, к кому идти?» — подобрать специалиста и показать время, а не отвечать общими словами.
    if ((q === 'other' || turn.frame.subject === 'symptom') && s.entities.symptom && !['price', 'address', 'hours'].includes(q)) {
      s.goal = 'book';
      return this.book(turn);
    }
    const enabled = profile.features.questions as string[];
    if (!enabled.includes(q)) return this.freeAnswer(turn);

    if (q === 'address') {
      const clinics = await turn.catalog.clinics();
      return this.finish(turn, { text: `${T.t('addresses')}\n${clinics.map((c) => `- ${c.name}${c.address ? ` — ${c.address}` : ''}${c.phone ? `, ${c.phone}` : ''}`).join('\n')}` });
    }
    if (q === 'hours') {
      if (profile.info.hours) return this.finish(turn, { text: profile.info.hours });
      const phones = (await turn.catalog.clinics()).filter((c) => c.phone).map((c) => `- ${c.name}: ${c.phone}`);
      return this.finish(turn, { text: [T.t('hoursUnknown'), ...phones].join('\n') });
    }
    if (q === 'preparation') {
      // Памяток по подготовке в каталоге нет — не просить модель сочинять, дать телефоны и предложить запись.
      const phones = (await turn.catalog.clinics()).filter((c) => c.phone).map((c) => `- ${c.name}: ${c.phone}`);
      const r0 = await resolveTarget(s.entities, { clinicNetId: turn.session.clinicNetId, search: this.deps.search, profile });
      const what = r0.kind === 'single' ? `«${targetLabel(r0.target)}»` : 'исследованию';
      if (r0.kind === 'single') s.target = r0.target;
      s.goal = 'book';
      s.expectation = { kind: 'yes_no', field: 'proceed' };
      return { text: [T.t('preparationUnknown', { what }), ...phones, '', T.t('offerBooking')].join('\n'), quickReplies: YES_NO };
    }
    if (q === 'walk_in') {
      const key = { yes: 'walkInYes', no: 'walkInNo', unknown: 'walkInUnknown' }[profile.features.walkIn];
      turn.prefix.push(T.t(key));
      if (s.entities.symptom || s.entities.speciality || s.entities.doctorName || s.entities.serviceQuery) {
        s.goal = 'book';
        s.entities.now = true;
        return this.book(turn);
      }
      return this.finish(turn, { text: '' });
    }

    // Цель уже выбрана (кнопкой или раньше в диалоге) — вопрос о ней, а не новый поиск.
    const r: Awaited<ReturnType<typeof resolveTarget>> = s.target
      ? { kind: 'single', target: s.target }
      : await resolveTarget(s.entities, { clinicNetId: turn.session.clinicNetId, search: this.deps.search, profile });
    if (r.kind === 'missing') return this.freeAnswer(turn);
    if (r.kind === 'none') return this.finish(turn, { text: T.t('notFound', { query: r.query }) });
    if (r.kind === 'choice' || r.kind === 'areas') {
      s.goal = 'book';
      if (r.kind === 'areas') return this.offer(turn, T.t('chooseArea'), r.areas.map((a) => ({ kind: 'area', targets: a.targets, aliases: a.aliases, label: a.label })));
      return this.offer(turn, T.t('chooseTarget'), r.targets.map((t) => ({ kind: 'target', target: t, label: targetLabel(t) })));
    }
    s.target = r.target;

    if (q === 'has_service' && r.target.kind === 'service') {
      s.expectation = { kind: 'yes_no', field: 'proceed' };
      return { text: `Да, «${r.target.name}» есть. ${T.t('offerBooking')}`, quickReplies: YES_NO };
    }
    if (q === 'price') return this.price(turn, r.target);
    if (q === 'schedule') {
      s.goal = 'book';
      const asked = slotWindow(s.entities, this.now()).date;
      const r2 = await this.pickSlot(turn);
      if (r2 && asked && s.options.some((o) => o.kind === 'slot' && o.slot.date === asked) && !turn.prefix.length) {
        const who = r2.text.split('\n')[0];
        return { ...r2, text: r2.text.replace(who, `Да, ${targetLabel(r.target)} принимает в этот день. Свободное время:`) };
      }
      if (r2) return r2;
      return this.book(turn);
    }
    return this.freeAnswer(turn);
  }

  private async price(turn: Turn, t: Target): Promise<Reply> {
    const s = turn.state;
    const lines: string[] = [];
    if (t.kind === 'service') {
      const prices = t.clinics.filter((c) => c.price).map((c) => `- ${c.name}: ${t.priceFrom ? 'от ' : ''}${c.price} ₽`);
      lines.push(prices.length ? `«${t.name}»:\n${prices.join('\n')}` : `Цену «${t.name}» лучше уточнить у администратора.`);
    } else {
      const doctorIds = t.kind === 'doctor' ? [t.doctorId] : t.doctorIds.slice(0, 3);
      const visits = (await Promise.all(doctorIds.map((id) => turn.booking.visitServices(id).catch(() => [] as VisitService[])))).flat();
      const uniq = new Map(visits.filter((v) => v.price).map((v) => [`${visitLabel(v, false)}:${v.price}`, v]));
      lines.push(uniq.size ? `Приём — ${targetLabel(t)}:\n${[...uniq.values()].slice(0, 6).map((v) => `- ${visitLabel(v, true)}`).join('\n')}` : `Цену приёма лучше уточнить у администратора.`);
    }
    s.goal = 'book';
    s.expectation = { kind: 'yes_no', field: 'proceed' };
    return { text: `${lines.join('\n')}\n\n${turn.T.t('offerBooking')}`, quickReplies: YES_NO };
  }

  // ── Записи пациента ───────────────────────────────────────────────────────

  private async listAppointments(turn: Turn): Promise<Appointment[] | Reply> {
    const caps = turn.booking.capabilities();
    const p = this.patient(turn);
    if (caps.patientAppointments === 'none') return { text: turn.T.t('needLogin') };
    if (caps.patientAppointments === 'client_id' && !p.clientId) return { text: turn.T.t('needLogin') };
    if (caps.patientAppointments === 'phone' && !p.data?.phone) return { text: turn.T.t('needLogin') };
    return turn.booking.patientAppointments(p);
  }

  private async myAppointments(turn: Turn): Promise<Reply> {
    const list = await this.listAppointments(turn);
    if (!Array.isArray(list)) return this.finish(turn, list);
    if (list.length === 0) return this.finish(turn, { text: turn.T.t('noAppointments') });
    return this.finish(turn, { text: `${turn.T.t('appointmentsList')}\n${list.map((a) => `- ${appointmentLabel(a)}`).join('\n')}` });
  }

  private async changeAppointment(turn: Turn): Promise<Reply> {
    const s = turn.state;
    const { T } = turn;
    if (!s.appointment) {
      const list = await this.listAppointments(turn);
      if (!Array.isArray(list)) return this.finish(turn, list);
      const day = slotWindow(s.entities, this.now()).date;
      const name = (s.entities.doctorName ?? s.entities.speciality ?? s.entities.serviceQuery ?? '').toLowerCase().slice(0, 5);
      const matching = list.filter((a) =>
        (!day || a.date === day) &&
        (!name || [a.doctorName, a.speciality, a.serviceName].some((x) => x?.toLowerCase().includes(name))),
      );
      const candidates = matching.length ? matching : list;
      if (candidates.length === 0) return this.finish(turn, { text: T.t('noAppointments') });
      if (candidates.length > 1) {
        return this.offer(turn, T.t('chooseAppointment'), candidates.slice(0, 8).map((a) => ({ kind: 'appointment', appointment: a, label: appointmentLabel(a) })));
      }
      s.appointment = candidates[0];
    }
    const a = s.appointment;

    if (s.goal === 'cancel') {
      s.expectation = { kind: 'confirm' };
      return { text: T.t('confirmCancel', { summary: appointmentLabel(a) }), quickReplies: [{ label: 'Отменить', payload: 'yes' }, { label: 'Нет', payload: 'no' }] };
    }

    // Перенос: новое время к тому же врачу / на ту же услугу; «на другой день» — без этой даты.
    if (/друг(ой|ие|ую)\s+(день|дни|дату|число)/i.test(turn.text)) s.excludeDate = a.date;
    if (!s.target) {
      if (a.doctorId) s.target = { kind: 'doctor', doctorId: a.doctorId, name: a.doctorName ?? '' };
      else if (a.serviceId !== undefined) {
        s.target = { kind: 'service', serviceId: a.serviceId, name: a.serviceName ?? '', selfBooking: true, atDoctorVisit: false, direction: null, clinics: [], priceFrom: false };
      } else {
        return this.finish(turn, { text: 'Перенести эту запись можно по телефону клиники.' });
      }
    }
    if (!s.slot) {
      const r = await this.pickSlot(turn);
      if (r) return r;
    }
    s.expectation = { kind: 'confirm' };
    return {
      text: T.t('confirmReschedule', { old: appointmentLabel(a), new: `${lowerFirst(s.slot!.dateLabel)}, ${s.slot!.time}` }),
      quickReplies: [{ label: 'Перенести', payload: 'yes' }, { label: 'Нет', payload: 'no' }],
    };
  }

  private async doCancel(turn: Turn): Promise<Reply> {
    const a = turn.state.appointment;
    if (!a) return this.changeAppointment(turn);
    const res = await turn.booking.cancel(a.ref, this.patient(turn));
    return this.finish(turn, { text: res.success ? turn.T.t('cancelled') : turn.T.t('cancelFailed', { reason: res.message }) });
  }

  private async doReschedule(turn: Turn): Promise<Reply> {
    const s = turn.state;
    if (!s.appointment || !s.slot || !s.target) return this.changeAppointment(turn);
    const res = await turn.booking.reschedule(s.appointment.ref, {
      slot: s.slot,
      doctorId: s.target.kind === 'service' ? undefined : s.slot.doctorId,
      serviceId: s.target.kind === 'service' ? s.target.serviceId : undefined,
      patient: this.patient(turn),
    });
    if (res.status === 'booked') return this.finish(turn, { text: turn.T.t('rescheduled', { summary: this.summary(turn) }) });
    return this.finish(turn, { text: turn.T.t('bookFailed', { reason: res.message }) });
  }

  // ── Свободный ответ ───────────────────────────────────────────────────────

  private async freeAnswer(turn: Turn): Promise<Reply> {
    if (!turn.text) return { text: turn.T.t('fallback') };
    const res = await this.deps.answers.agent(turn.text, turn.catalog, this.answerCtx(turn));
    this.usage(turn, res);
    return { text: res.text || turn.T.t('fallback') };
  }

  // ── Вспомогательное ───────────────────────────────────────────────────────

  private offer(turn: Turn, title: string, options: Option[], expectation?: Expectation): Reply {
    const s = turn.state;
    s.options = options;
    s.expectation = expectation ?? {
      kind: 'choice',
      options: options.map((o) => ({ label: o.label, aliases: aliasesOf(o) })),
    };
    return { text: `${title}\n${numbered(options)}`, quickReplies: choiceButtons(options) };
  }

  /** Первый раз — всё одним сообщением; если часть данных уже есть — только недостающее. */
  private askPatientData(turn: Turn, need: Array<'fullName' | 'phone' | 'birthday'>): string {
    const p = turn.session.patient;
    const hasSome = !!(p?.lastName || p?.phone || p?.birthday);
    if (!hasSome) return turn.T.t('askPatientData');
    const names = { fullName: 'ФИО', phone: 'телефон', birthday: 'дату рождения' };
    const list = need.map((f) => names[f]);
    const text = list.length > 1 ? `${list.slice(0, -1).join(', ')} и ${list[list.length - 1]}` : list[0];
    return turn.T.t('askPatientDataRest', { fields: text });
  }

  private missingPatientFields(turn: Turn): Array<'fullName' | 'phone' | 'birthday'> {
    if (turn.session.clientId) return [];
    const caps = turn.booking.capabilities();
    const fields = [...new Set([...turn.profile.patientFields, ...caps.guestRequiredFields])];
    const p = turn.session.patient;
    return fields.filter((f) => (f === 'fullName' ? !(p?.lastName && p?.firstName) : !p?.[f]));
  }

  private patient(turn: Turn): PatientIdentity {
    return { clientId: turn.session.clientId, data: turn.session.patient };
  }

  private summary(turn: Turn): string {
    const s = turn.state;
    const showPrice = turn.profile.features.showPrices === 'always' || (turn.profile.features.showPrices === 'on_request' && !!s.visit);
    const lines: string[] = [];
    const t = s.target;
    if (t?.kind === 'service') lines.push(`Услуга: ${t.name}`);
    else if (s.slot?.doctorName || t?.kind === 'doctor') lines.push(`Врач: ${s.slot?.doctorName ?? (t as any).name}`);
    if (t?.kind === 'speciality') lines.push(`Специальность: ${t.title}`);
    if (s.visit) lines.push(`Приём: ${visitLabel(s.visit, showPrice)}`);
    if (s.slot) {
      lines.push(`Когда: ${s.slot.dateLabel}, ${s.slot.time}`);
      lines.push(`Где: ${s.slot.clinicName}`);
    }
    return lines.map((l) => `- ${l}`).join('\n');
  }

  private answerCtx(turn: Turn) {
    return {
      clinicNetId: turn.session.clinicNetId,
      mis: turn.mis,
      provider: turn.session.provider,
      model: turn.session.model,
      recent: turn.session.messages.slice(-5, -1),
    };
  }

  private usage(turn: Turn, res: AnswerResult): void {
    for (const u of res.usage) this.deps.onUsage?.(turn.session, res.task, u, res.promptHash);
  }

  private say(session: DialogSession, text: string, quickReplies?: QuickReply[]): Reply {
    session.messages.push({ role: 'assistant', content: text });
    session.updatedAt = Date.now();
    return quickReplies?.length ? { text, quickReplies } : { text };
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }
}

/** Кнопка: "choice:2" / "yes" / "no" / "goal:book:service:<id>:<название>". */
export function payloadFrame(payload?: string): Frame | null {
  if (!payload) return null;
  const choice = /^choice:(\d+)$/.exec(payload);
  if (choice) return { choice: Number(choice[1]), entities: {} };
  if (payload === 'yes' || payload === 'no') return { reply: payload, entities: {} };
  const svc = /^book:service:(.+)$/.exec(payload);
  if (svc) return { goal: 'book', subject: 'service', entities: { serviceQuery: svc[1] } };
  const doc = /^book:doctor:(.+)$/.exec(payload);
  if (doc) return { goal: 'book', subject: 'doctor', entities: { doctorName: doc[1] } };
  return null;
}

const SUBJECT_KEYS = ['doctorName', 'speciality', 'serviceQuery'] as const;
const SUBJECT_KINDS: Record<(typeof SUBJECT_KEYS)[number], Array<'doctor' | 'speciality' | 'service'>> = {
  doctorName: ['doctor'],
  speciality: ['speciality'],
  serviceQuery: ['service', 'speciality'],
};

/** Слова текущего выбора: цель и то, чем её назвали (название услуги с кнопки остаётся, даже если цель стала врачом). */
function chosenWords(s: DialogState): string[] {
  const t = s.target!;
  const label = t.kind === 'service' ? t.name : t.kind === 'doctor' ? `${t.name} ${t.speciality ?? ''}` : t.title;
  return words([s.entities.serviceQuery, s.entities.speciality, s.entities.doctorName, label].filter(Boolean).join(' '));
}

/** Все слова названного уже есть в текущем выборе — без поиска. */
function restatesByWords(value: string, known: string[]): boolean {
  const ws = words(value).filter((w) => w.length >= 3);
  return ws.length > 0 && ws.every((w) => known.some((k) => k === w || sameStem(k, w)));
}

/** Выдача поиска указывает на текущий выбор: та же услуга/врач/специальность или услуга, выбранная кнопкой. */
function hitIsChosen(h: SearchHit, s: DialogState): boolean {
  const t = s.target!;
  if (t.kind === 'service' && h.kind === 'service' && h.entityId === String(t.serviceId)) return true;
  if (t.kind === 'doctor' && h.kind === 'doctor' && h.entityId === String(t.doctorId)) return true;
  if (t.kind === 'speciality' && h.kind === 'speciality' && normalize(h.title) === normalize(t.title)) return true;
  return !!s.entities.serviceQuery && h.kind === 'service' && normalize(h.title) === normalize(s.entities.serviceQuery);
}

function onlyPatientData(f: Frame): boolean {
  const keys = Object.entries(f.entities ?? {}).filter(([, v]) => v !== undefined).map(([k]) => k);
  const patient = ['lastName', 'firstName', 'secondName', 'phone', 'birthday'];
  return keys.length > 0 && keys.every((k) => patient.includes(k));
}

function hasConstraints(f: Frame): boolean {
  return Object.values(f.entities ?? {}).some((v) => v !== undefined);
}

function inferGoal(f: Frame): Frame['goal'] {
  if (f.subject === 'symptom' || f.entities?.symptom) return 'book';
  if (f.question) return 'info';
  const e = f.entities ?? {};
  if (e.doctorName || e.speciality || e.serviceQuery || e.symptom) return 'book';
  if (f.choice || f.reply) return undefined;
  return 'other';
}

function lowerFirst(s: string): string {
  return /^(Сегодня|Завтра|Послезавтра)/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const n = new Date(y, m - 1, d + 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function firstPerDoctor(slots: Slot[]): Slot[] {
  const seen = new Set<number | undefined>();
  return slots.filter((s) => (seen.has(s.doctorId) ? false : (seen.add(s.doctorId), true)));
}

function aliasesOf(o: Option): string[] {
  if (o.kind === 'slot') return [o.slot.time, ...(o.slot.doctorName ? [o.slot.doctorName.split(' ')[0]] : [])];
  if (o.kind === 'target' && o.target.kind === 'doctor') return [o.target.name.split(' ')[0]];
  if (o.kind === 'appointment') return [o.appointment.time];
  if (o.kind === 'area') return o.aliases;
  return [];
}

function dayWord(e: FrameEntities, date: string): string {
  if (e.relativeDay === 'today' || e.now) return 'сегодня';
  if (e.relativeDay === 'tomorrow') return 'завтра';
  const [y, m, d] = date.split('-').map(Number);
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d} ${months[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
}

export { shortName };
