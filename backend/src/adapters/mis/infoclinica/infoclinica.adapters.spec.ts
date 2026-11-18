import { InfoclinicaBookingAdapter, parseIcRef } from './infoclinica.adapters';

function setup() {
  const ic: any = {
    getAvailableSlots: jest.fn().mockResolvedValue([
      { date: '2030-01-10', dateLabel: 'Четверг, 10 января', clinicId: 1, clinicName: 'Филиал', times: ['09:00'] },
      { date: '2030-01-11', dateLabel: 'Пятница, 11 января', clinicId: 1, clinicName: 'Филиал', times: ['09:00'] },
    ]),
    bookAppointment: jest.fn().mockResolvedValue({ success: true, appointmentId: 777, message: 'ok' }),
    findPatientAppointment: jest.fn().mockResolvedValue([
      { id: 777, type: 'doctor', date: '2030-01-10', time: '09:00', clinicId: 1, clinicName: 'Филиал', doctorId: 3 },
    ]),
    cancelAppointment: jest.fn().mockResolvedValue({ success: true, message: 'Отменено' }),
  };
  return { ic, adapter: new InfoclinicaBookingAdapter(1, ic, {} as any) };
}

describe('InfoclinicaBookingAdapter', () => {
  it('mode=day оставляет только запрошенный день', async () => {
    const { adapter } = setup();
    const slots = await adapter.findSlots({ doctorId: 3, date: '2030-01-11', mode: 'day' });
    expect(slots.map((s) => s.date)).toEqual(['2030-01-11']);
  });

  it('ref записи содержит филиал — он нужен для отмены', async () => {
    const { ic, adapter } = setup();
    const [slot] = await adapter.findSlots({ doctorId: 3 });
    const res = await adapter.book({ slot, doctorId: 3, patient: { clientId: 9 } });
    expect(res).toMatchObject({ status: 'booked', appointmentRef: '777@1' });
    expect(await adapter.cancel('777@1', { clientId: 9 })).toMatchObject({ success: true });
    expect(ic.cancelAppointment).toHaveBeenCalledWith(777, 1);
  });

  it('запись на услугу не поддерживается', async () => {
    const { adapter } = setup();
    const [slot] = await adapter.findSlots({ doctorId: 3 });
    expect(await adapter.book({ slot, serviceId: 5, patient: {} })).toMatchObject({ status: 'rejected', reason: 'not_supported' });
  });

  it('parseIcRef', () => {
    expect(parseIcRef('5@2')).toEqual({ schedId: 5, filialId: 2 });
    expect(parseIcRef('doctor:5')).toBeNull();
  });
});
