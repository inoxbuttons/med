import { LocalBookingAdapter, parseLocalRef } from './local-booking.adapter';
import { LocalCatalogSource } from './local-catalog.source';

const NET = 2;
const clinics = [
  { id: 3, name: 'Русское поле', address: null, phone: null },
  { id: 4, name: 'Северный', address: null, phone: null },
];

function setup() {
  const local: any = {
    getClinics: jest.fn().mockResolvedValue(clinics),
    getAvailableSlots: jest.fn(),
    findDoctors: jest.fn().mockResolvedValue([{ id: 5, name: 'Иванова Анна Петровна', speciality: 'Терапевт', price: null, clinics: [] }]),
    findDoctorConsultationServices: jest.fn().mockResolvedValue([]),
    checkPatientTimeConflict: jest.fn().mockResolvedValue(null),
    bookAppointment: jest.fn(),
    findPatientAppointment: jest.fn().mockResolvedValue([]),
    cancelAppointment: jest.fn().mockResolvedValue({ success: true, message: 'Запись отменена.' }),
    rescheduleAppointment: jest.fn(),
    createOperatorRequest: jest.fn().mockResolvedValue({ id: 7, message: 'Заявка принята.' }),
  };
  const catalog = new LocalCatalogSource(NET, local, {} as any);
  return { local, adapter: new LocalBookingAdapter(NET, local, catalog) };
}

const slot = {
  start: '2030-01-10T10:00:00', end: null, date: '2030-01-10', time: '10:00',
  dateLabel: 'Четверг, 10 января', clinicId: 3, clinicName: 'Русское поле',
};

describe('LocalBookingAdapter', () => {
  it('разворачивает группы в слоты и отбрасывает клиники чужой сети', async () => {
    const { local, adapter } = setup();
    local.getAvailableSlots.mockResolvedValue([
      { date: '2030-01-10', dateLabel: 'Четверг, 10 января', clinicId: 3, clinicName: 'Русское поле', times: ['10:30', '10:00'] },
      { date: '2030-01-10', dateLabel: 'Четверг, 10 января', clinicId: 99, clinicName: 'Чужая', times: ['09:00'] },
    ]);
    const slots = await adapter.findSlots({ doctorId: 5 });
    expect(slots.map((s) => s.start)).toEqual(['2030-01-10T10:00:00', '2030-01-10T10:30:00']);
    expect(slots[0]).toMatchObject({ doctorId: 5, doctorName: 'Иванова Анна Петровна', clinicId: 3 });
    expect(local.getAvailableSlots).toHaveBeenCalledWith(expect.objectContaining({ mode: 'nearest' }));
  });

  it('не ищет слоты в клинике другой сети', async () => {
    const { local, adapter } = setup();
    expect(await adapter.findSlots({ doctorId: 5, clinicId: 99 })).toEqual([]);
    expect(local.getAvailableSlots).not.toHaveBeenCalled();
  });

  it('запись к врачу не передаёт serviceId (иначе создаётся запись на услугу без врача)', async () => {
    const { local, adapter } = setup();
    local.bookAppointment.mockResolvedValue({ success: true, appointmentId: 11, message: 'ok' });
    const res = await adapter.book({ slot, doctorId: 5, visitServiceId: 40, patient: { clientId: 1 } });
    expect(res).toEqual({ status: 'booked', appointmentRef: 'doctor:11', message: 'ok' });
    const args = local.bookAppointment.mock.calls[0][0];
    expect(args.serviceId).toBeUndefined();
    expect(args.comment).toContain('#40');
  });

  it('данные гостя попадают в комментарий записи', async () => {
    const { local, adapter } = setup();
    local.bookAppointment.mockResolvedValue({ success: true, appointmentId: 12, message: 'ok' });
    await adapter.book({
      slot, serviceId: 8,
      patient: { data: { lastName: 'Иванов', firstName: 'Иван', phone: '79001234567', birthday: '1990-01-01' } },
    });
    const args = local.bookAppointment.mock.calls[0][0];
    expect(args.serviceId).toBe(8);
    expect(args.comment).toContain('Иванов Иван');
    expect(args.comment).toContain('79001234567');
  });

  it('конфликт по времени у пациента возвращает ref существующей записи', async () => {
    const { local, adapter } = setup();
    local.checkPatientTimeConflict.mockResolvedValue({ id: 3, type: 'service', description: '10 янв, 10:00 на УЗИ' });
    const res = await adapter.book({ slot, doctorId: 5, patient: { clientId: 1 } });
    expect(res).toMatchObject({ status: 'conflict', existingRef: 'service:3' });
    expect(local.bookAppointment).not.toHaveBeenCalled();
  });

  it('отказ «занято» превращается в slot_taken', async () => {
    const { local, adapter } = setup();
    local.bookAppointment.mockResolvedValue({ success: false, message: 'Это время уже занято. Пожалуйста, выберите другой слот.' });
    expect(await adapter.book({ slot, doctorId: 5, patient: {} })).toMatchObject({ status: 'rejected', reason: 'slot_taken' });
  });

  it('запись в чужой сети отклоняется', async () => {
    const { local, adapter } = setup();
    const res = await adapter.book({ slot: { ...slot, clinicId: 99 }, doctorId: 5, patient: {} });
    expect(res).toMatchObject({ status: 'rejected', reason: 'outside_net' });
    expect(local.bookAppointment).not.toHaveBeenCalled();
  });

  it('отменить можно только свою запись', async () => {
    const { local, adapter } = setup();
    local.findPatientAppointment.mockResolvedValue([
      { id: 5, type: 'doctor', date: '2030-01-10', time: '10:00', clinicId: 3, clinicName: 'Русское поле' },
    ]);
    expect(await adapter.cancel('doctor:6', { clientId: 1 })).toMatchObject({ success: false });
    expect(await adapter.cancel('doctor:5', { clientId: 1 })).toMatchObject({ success: true });
    expect(local.cancelAppointment).toHaveBeenCalledWith(5, 'doctor');
    expect(await adapter.cancel('doctor:5', {})).toMatchObject({ success: false });
  });

  it('parseLocalRef', () => {
    expect(parseLocalRef('service:12')).toEqual({ kind: 'service', id: 12 });
    expect(parseLocalRef('12')).toBeNull();
  });
});
