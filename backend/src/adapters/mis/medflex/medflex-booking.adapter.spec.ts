import { decodeMfRef, MedflexBookingAdapter } from './medflex-booking.adapter';
import { MedflexCatalogSource } from './medflex-catalog.source';

const NET = 1;

function setup() {
  const client: any = {
    apiKey: 'mock',
    getDoctors: jest.fn().mockResolvedValue({
      count: 1, num_pages: 1, links: { next: null, previous: null },
      data: [{ id: 50, efio: 'Петрова А. А.', specialities: [7], lpus: [10, 20], prices: [{ speciality_id: 7, price: 2500 }] }],
    }),
    getServicePrices: jest.fn().mockResolvedValue([]),
  };
  const mf: any = {
    getClinics: jest.fn().mockResolvedValue([{ id: 10, name: 'Центр', address: '', phone: null }]),
    getCachedSpecialities: jest.fn().mockResolvedValue([{ id: 7, name: 'Терапевт' }]),
    getAvailableSlots: jest.fn().mockResolvedValue([
      {
        date: '2030-01-10', dateLabel: 'Четверг, 10 января', clinicId: 10, clinicName: 'Центр',
        times: ['10:00', '10:30'],
        dtSlots: [
          { dt_start: '2030-01-10 10:00', dt_end: '2030-01-10 10:30' },
          { dt_start: '2030-01-10 10:30', dt_end: '2030-01-10 11:00' },
        ],
      },
    ]),
    bookAppointment: jest.fn(),
    findConflictingAppointment: jest.fn(),
    getPatientAppointments: jest.fn().mockResolvedValue([]),
    cancelAppointment: jest.fn().mockResolvedValue({ success: true, message: 'Запись успешно отменена.' }),
  };
  const ctx = { client, lpuGroupId: NET };
  const catalog = new MedflexCatalogSource(NET, mf, ctx);
  const adapter = new MedflexBookingAdapter(NET, mf, {} as any, ctx, catalog);
  return { mf, client, adapter };
}

const patient = { data: { lastName: 'Иванов', firstName: 'Иван', phone: '79001234567', birthday: '1990-01-01' } };

describe('MedflexBookingAdapter', () => {
  it('слоты врача несут в ref всё, что нужно для записи; клиники вне сети пропускаются', async () => {
    const { mf, adapter } = setup();
    const slots = await adapter.findSlots({ doctorId: 50 });
    expect(mf.getAvailableSlots).toHaveBeenCalledTimes(1); // lpu 20 не входит в сеть
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ start: '2030-01-10T10:00:00', end: '2030-01-10T10:30:00', doctorId: 50, doctorName: 'Петрова А. А.' });
    expect(decodeMfRef(slots[0].ref)).toEqual({ dtStart: '2030-01-10 10:00', dtEnd: '2030-01-10 10:30', specialityId: 7, price: 2500 });
  });

  it('запись берёт dt_start/dt_end, специальность и цену из ref слота', async () => {
    const { mf, adapter } = setup();
    const [slot] = await adapter.findSlots({ doctorId: 50 });
    mf.bookAppointment.mockResolvedValue({ success: true, uuid: 'u-1', message: 'Запись подтверждена!' });
    const res = await adapter.book({ slot, doctorId: 50, patient });
    expect(res).toEqual({ status: 'booked', appointmentRef: 'u-1', message: 'Запись подтверждена!' });
    expect(mf.bookAppointment.mock.calls[0][1]).toMatchObject({
      doctorId: 50, clinicId: 10, specialityId: 7, price: 2500,
      startTime: '2030-01-10 10:00', endTime: '2030-01-10 10:30', lastName: 'Иванов',
    });
  });

  it('без данных пациента запись не уходит в МИС', async () => {
    const { mf, adapter } = setup();
    const [slot] = await adapter.findSlots({ doctorId: 50 });
    const res = await adapter.book({ slot, doctorId: 50, patient: {} });
    expect(res).toMatchObject({ status: 'rejected', reason: 'patient_data_required' });
    expect((res as any).missing).toEqual(['фамилия', 'имя', 'телефон', 'дата рождения']);
    expect(mf.bookAppointment).not.toHaveBeenCalled();
  });

  it('409 от МИС — конфликт с uuid существующей записи', async () => {
    const { mf, adapter } = setup();
    const [slot] = await adapter.findSlots({ doctorId: 50 });
    mf.bookAppointment.mockRejectedValue(new Error('MedFlex API 409'));
    mf.findConflictingAppointment.mockResolvedValue({ uuid: 'old-1', description: '2030-01-10 в 10:00 у Петровой' });
    expect(await adapter.book({ slot, doctorId: 50, patient })).toMatchObject({
      status: 'conflict', existingRef: 'old-1', description: '2030-01-10 в 10:00 у Петровой',
    });
  });

  it('слот без ref (не из findSlots) отклоняется', async () => {
    const { adapter } = setup();
    const res = await adapter.book({
      slot: { start: '2030-01-10T10:00:00', end: null, date: '2030-01-10', time: '10:00', dateLabel: '', clinicId: 10, clinicName: 'Центр' },
      doctorId: 50, patient,
    });
    expect(res).toMatchObject({ status: 'rejected', reason: 'not_found' });
  });

  it('отмена только своей записи (по телефону пациента)', async () => {
    const { mf, adapter } = setup();
    mf.getPatientAppointments.mockResolvedValue([
      { uuid: 'u-1', type: 'doctor', date: '2030-01-10', time: '10:00', clinicName: 'Центр', canceled: false, price: 0 },
    ]);
    expect(await adapter.cancel('u-2', patient)).toMatchObject({ success: false });
    expect(await adapter.cancel('u-1', patient)).toMatchObject({ success: true });
    expect(await adapter.cancel('u-1', {})).toMatchObject({ success: false });
  });
});
