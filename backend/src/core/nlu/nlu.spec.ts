import * as path from 'path';
import { ClinicProfileService } from '../profile/clinic-profile.service';
import { PromptBuilder } from '../prompts/prompt-builder.service';
import { FRAME_JSON_SCHEMA, parseFrame } from './frame';
import { NluService } from './nlu.service';
import { parseByRules, parseChoice, parseDay, parsePatientData, parseTime } from './rule-parser';

describe('parseByRules', () => {
  it('приветствие и «мои записи» — без модели', () => {
    expect(parseByRules('Здравствуйте!', { kind: 'none' })).toEqual({ goal: 'smalltalk', entities: {} });
    expect(parseByRules('мои записи', { kind: 'none' })).toEqual({ goal: 'my_appointments', entities: {} });
    expect(parseByRules('Хочу к неврологу', { kind: 'none' })).toBeNull();
  });

  it('подтверждение: короткое да/нет; «да, но…» — к модели', () => {
    expect(parseByRules('Да', { kind: 'confirm' })).toMatchObject({ reply: 'yes' });
    expect(parseByRules('подтверждаю', { kind: 'confirm' })).toMatchObject({ reply: 'yes' });
    expect(parseByRules('нет, не надо', { kind: 'confirm' })).toMatchObject({ reply: 'no' });
    expect(parseByRules('давно хотела', { kind: 'confirm' })).toBeNull();
    expect(parseByRules('да, но лучше в четверг после обеда', { kind: 'confirm' })).toBeNull();
    expect(parseByRules('нет, лучше в пятницу', { kind: 'confirm' })).toBeNull();
  });

  it('направление: да/нет → hasReferral', () => {
    expect(parseByRules('есть', { kind: 'yes_no', field: 'hasReferral' })).toBeNull();
    expect(parseByRules('да', { kind: 'yes_no', field: 'hasReferral' })).toMatchObject({ reply: 'yes', entities: { hasReferral: true } });
  });

  const options = [
    { label: 'Петрова Анна, завтра 10:00', aliases: ['Петрова', '10:00'] },
    { label: 'Сидоров Олег, завтра 10:30', aliases: ['Сидоров', '10:30'] },
  ];

  it('выбор варианта: номер, порядковое, время, фамилия', () => {
    expect(parseByRules('2', { kind: 'choice', options })).toMatchObject({ choice: 2 });
    expect(parseChoice('второй', options)).toBe(2);
    expect(parseChoice('давайте 10:30', options)).toBe(2);
    expect(parseChoice('к Петровой', options)).toBe(1);
    expect(parseChoice('5', options)).toBeNull();
    expect(parseChoice('а есть в пятницу?', options)).toBeNull();
  });

  it('тип приёма', () => {
    expect(parseByRules('первичный', { kind: 'visit_type' })).toEqual({ entities: { visitType: 'primary' } });
    expect(parseByRules('уже была у него', { kind: 'visit_type' })).toEqual({ entities: { visitType: 'repeat' } });
  });

  it('день и время', () => {
    expect(parseByRules('завтра в 15:30', { kind: 'date' })).toEqual({ entities: { relativeDay: 'tomorrow', time: '15:30' } });
    expect(parseByRules('в четверг', { kind: 'date' })).toEqual({ entities: { dayOfWeek: 'thu' } });
    expect(parseDay('в среду на следующей неделе')).toEqual({ dayOfWeek: 'wed', nextWeek: true });
    expect(parseTime('в 9 часов')).toBe('09:00');
    expect(parseByRules('в четверг, но только если у Петровой и после обеда', { kind: 'date' })).toBeNull();
  });

  it('данные пациента одним сообщением', () => {
    expect(parsePatientData('Иванов Иван Иванович, +7 (900) 123-45-67, 01.02.1990')).toEqual({
      lastName: 'Иванов', firstName: 'Иван', secondName: 'Иванович', phone: '79001234567', birthday: '1990-02-01',
    });
    const exp = { kind: 'patient_data' as const, fields: ['fullName' as const, 'phone' as const, 'birthday' as const] };
    expect(parseByRules('Петрова Анна 89001234567 5 марта 1985', exp)).toMatchObject({
      entities: { lastName: 'Петрова', firstName: 'Анна', phone: '79001234567', birthday: '1985-03-05' },
    });
    expect(parseByRules('Петрова Анна', exp)).toBeNull();
  });
});

describe('parseFrame', () => {
  it('отбрасывает неверные поля, а не весь ответ', () => {
    expect(parseFrame({ goal: 'book', subject: 'robot', entities: { dayOfWeek: 'суббота', time: '15:00', serviceQuery: '' }, choice: 0 })).toEqual({
      goal: 'book', entities: { time: '15:00' },
    });
    expect(parseFrame('текст')).toBeNull();
    expect(parseFrame({ goal: 'cancel', entities: {}, next: [{ goal: 'book', entities: { dayOfWeek: 'fri' } }] })).toMatchObject({
      next: [{ goal: 'book', entities: { dayOfWeek: 'fri' } }],
    });
  });

  it('JSON-схема и zod-схема описывают одни и те же поля сущностей', () => {
    const jsonKeys = Object.keys((FRAME_JSON_SCHEMA as any).properties.entities.properties).sort();
    const parsed = parseFrame({ entities: Object.fromEntries(jsonKeys.map((k) => [k, 'x'])) });
    expect(parsed).not.toBeNull();
    // каждое поле JSON-схемы известно zod (иначе dropInvalid его молча выбросит)
    const zodKeys = Object.keys(require('./frame').frameSchema.shape.entities._def.innerType.shape).sort();
    expect(jsonKeys).toEqual(zodKeys);
  });
});

describe('NluService', () => {
  const root = path.resolve(__dirname, '../../clinics');
  const profiles = new ClinicProfileService(root);
  profiles.reload();
  const prompts = new PromptBuilder(profiles, root);
  const ctx = { clinicNetId: 2, mis: 'local' as const, provider: 'qwen3' as const, expectation: { kind: 'none' as const }, now: new Date(2026, 10, 18) };

  it('правила — без вызова модели', async () => {
    const llm = { complete: jest.fn(), completeJson: jest.fn() };
    const res = await new NluService(llm, prompts).parse('Привет', ctx);
    expect(res.source).toBe('rules');
    expect(llm.completeJson).not.toHaveBeenCalled();
  });

  it('модель: промпт с датой, состояние — в сообщении пользователя', async () => {
    const llm = {
      complete: jest.fn(),
      completeJson: jest.fn().mockResolvedValue({ data: { goal: 'info', question: 'schedule', entities: { doctorName: 'Нестерова', dayOfWeek: 'sat' } }, raw: '', usage: { promptTokens: 700, completionTokens: 30, totalTokens: 730 } }),
    };
    const res = await new NluService(llm, prompts).parse('Работает ли Нестерова в субботу?', { ...ctx, stateSummary: 'нет активной цели' });
    expect(res).toMatchObject({ source: 'llm', frame: { goal: 'info', question: 'schedule' } });
    const req = llm.completeJson.mock.calls[0][0];
    expect(req.messages[0].content).toContain('Сегодня 2026-11-18 (среда)');
    expect(req.messages[1].content).toContain('Состояние диалога: нет активной цели');
    expect(req.messages[1].content).toContain('Реплика пациента: Работает ли Нестерова в субботу?');
  });

  it('текущий запрос — JSON без персональных данных; клиники грузятся только для модели', async () => {
    const llm = {
      complete: jest.fn(),
      completeJson: jest.fn().mockResolvedValue({ data: { entities: { clinic: '21 Век на Русском поле' } }, raw: '', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }),
    };
    const loadClinics = jest.fn().mockResolvedValue(['21 Век на Русском поле', '21 Век на Северном']);
    const entities = { speciality: 'терапевт', time: '14:00', lastName: 'Иванова', phone: '79001234567' };
    const res = await new NluService(llm, prompts).parse('А на Русском поле можно записаться?', { ...ctx, entities, loadClinics });
    expect(res.frame.entities).toEqual({ clinic: '21 Век на Русском поле' });
    const user = llm.completeJson.mock.calls[0][0].messages[1].content as string;
    expect(user).toContain('Текущий запрос (JSON): {"speciality":"терапевт","time":"14:00"}');
    expect(user).toContain('Клиники: 21 Век на Русском поле; 21 Век на Северном');
    expect(user).not.toContain('Иванова');
    expect(user).not.toContain('79001234567');

    // Простой ответ разбирают правила: ни модели, ни загрузки клиник.
    loadClinics.mockClear();
    await new NluService(llm, prompts).parse('да', { ...ctx, expectation: { kind: 'confirm' }, loadClinics });
    expect(loadClinics).not.toHaveBeenCalled();
  });

  it('невалидный ответ — один повтор, затем goal=other; токены суммируются', async () => {
    const llm = {
      complete: jest.fn(),
      completeJson: jest.fn().mockResolvedValue({ data: null, raw: 'не JSON', usage: { promptTokens: 10, completionTokens: 1, totalTokens: 11 } }),
    };
    const res = await new NluService(llm, prompts).parse('абракадабра', ctx);
    expect(llm.completeJson).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({ source: 'fallback', frame: { goal: 'other' }, usage: { totalTokens: 22 } });
  });
});

describe('parseFrame: unset', () => {
  it('оставляет только известные поля, без повторов', () => {
    expect(parseFrame({ unset: ['time', 'time', 'foo', 7, 'clinic'] })?.unset).toEqual(['time', 'clinic']);
    expect(parseFrame({ unset: ['foo'] })?.unset).toBeUndefined();
  });
});
