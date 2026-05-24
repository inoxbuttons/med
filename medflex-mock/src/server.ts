/**
 * Mock-сервер MedFlex API.
 *
 * Эмулирует поведение https://api.medflex.ru, включая структуру ответов и коды ошибок.
 *
 * ─── Эмуляция ошибок при записи ───────────────────────────────────────────────
 * Передайте в поле comment строку вида [ERROR:NNN], где NNN — HTTP-код:
 *   [ERROR:409]  → конфликт записи (другая запись на это время)
 *   [ERROR:423]  → слот занят
 *   [ERROR:400]  → некорректный запрос
 *   [ERROR:500]  → внутренняя ошибка сервера
 * Пример: comment: "тест [ERROR:409]"
 *
 * ─── Использование ────────────────────────────────────────────────────────────
 * PORT=3001 npm start
 *
 * В medflex.client.ts задайте MEDFLEX_BASE_URL=http://localhost:3001
 * (или измените BASE_V1/BASE_V2 на адрес mock-сервера).
 *
 * Авторизация: принимается любой непустой токен в заголовке `Authorization: Token <key>`.
 */

import express, { Request, Response, NextFunction } from 'express';
import { SPECIALITIES, LPUS, DOCTORS, SERVICE_CATEGORIES, SERVICES } from './data';
import { buildSchedule } from './schedule';
import {
  createAppointment,
  cancelAppointment,
  isSlotBooked,
  getHistory,
} from './store';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3001);

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Стандартный пагинированный ответ MedFlex. */
function page<T>(data: T[], total?: number, numPages?: number) {
  const count = total ?? data.length;
  return {
    count,
    num_pages: numPages ?? 1,
    links: { next: null, previous: null },
    data,
  };
}

/** Парсит comma-separated строку чисел в массив. */
function parseIds(s: string | undefined): number[] {
  if (!s) return [];
  return s.split(',').map(Number).filter(Boolean);
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Middleware: авторизация ────────────────────────────────────────────────────

app.use((req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Token ') || auth.length <= 'Token '.length) {
    res.status(401).json({ detail: 'Учетные данные не были предоставлены.' });
    return;
  }
  next();
});

// ── Middleware: логирование ────────────────────────────────────────────────────

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, req.query);
  next();
});

// ── GET /models/speciality/ ───────────────────────────────────────────────────

app.get('/models/speciality/', (_req: Request, res: Response) => {
  res.json(page(SPECIALITIES, SPECIALITIES.length));
});

// ── GET /models/lpu/ ─────────────────────────────────────────────────────────

app.get('/models/lpu/', (req: Request, res: Response) => {
  const lpuGroupId = req.query.lpu_group_id ? Number(req.query.lpu_group_id) : undefined;
  const townId     = req.query.town_id      ? Number(req.query.town_id)      : undefined;
  const specIds    = parseIds(req.query.speciality_ids as string | undefined);

  let lpus = LPUS;

  if (lpuGroupId !== undefined) {
    lpus = lpus.filter((l) => l.lpu_group_id === lpuGroupId);
  }
  if (townId !== undefined) {
    lpus = lpus.filter((l) => l.town_id === townId);
  }
  if (specIds.length > 0) {
    lpus = lpus.filter((l) => specIds.some((sid) => l.specialities.includes(sid)));
  }

  res.json(page(lpus, lpus.length));
});

// ── GET /models/doctor/ ───────────────────────────────────────────────────────

app.get('/models/doctor/', (req: Request, res: Response) => {
  const lpuIds     = parseIds(req.query.lpu_ids      as string | undefined);
  const specIds    = parseIds(req.query.speciality_ids as string | undefined);
  const doctorIds  = parseIds(req.query.doctor_ids   as string | undefined);

  let doctors = DOCTORS;

  if (doctorIds.length > 0) {
    doctors = doctors.filter((d) => doctorIds.includes(d.id));
  }
  if (lpuIds.length > 0) {
    doctors = doctors.filter((d) => lpuIds.some((id) => d.lpus.includes(id)));
  }
  if (specIds.length > 0) {
    doctors = doctors.filter((d) => specIds.some((sid) => d.specialities.includes(sid)));
  }

  const result = doctors.map((d) => ({
    id: d.id,
    efio: d.efio,
    specialities: d.specialities,
    lpus: d.lpus,
    prices: d.prices,
    rating: d.rating,
  }));

  res.json(page(result, result.length));
});

// ── GET /services/categories/ ────────────────────────────────────────────────
// Per spec: lpu_id обязателен. Возвращаем категории, у которых есть услуги в этой клинике.
// Ответ: { count, num_pages, links, data: { lpu_id, categories: [{ id, name }] } }

app.get('/services/categories/', (req: Request, res: Response) => {
  const lpuId = req.query.lpu_id ? Number(req.query.lpu_id) : NaN;
  if (!Number.isFinite(lpuId)) {
    res.status(400).json({ detail: 'Параметр lpu_id обязателен.' });
    return;
  }

  const categoryIds = new Set(SERVICES.filter((s) => s.lpu_id === lpuId).map((s) => s.category_id));
  const categories = SERVICE_CATEGORIES.filter((c) => categoryIds.has(c.id));

  res.json({
    count: categories.length,
    num_pages: 1,
    links: { next: null, previous: null },
    data: { lpu_id: lpuId, categories },
  });
});

// ── GET /services/prices/ ────────────────────────────────────────────────────
// Per spec: lpu_id обязателен; опционально doctor_id, category_ids (comma-separated).
// Ответ: { count, num_pages, links, data: { lpu_id, services: [{ id:string, category_id, name, duration:int|null, price, doctor_ids }] } }

app.get('/services/prices/', (req: Request, res: Response) => {
  const lpuId = req.query.lpu_id ? Number(req.query.lpu_id) : NaN;
  if (!Number.isFinite(lpuId)) {
    res.status(400).json({ detail: 'Параметр lpu_id обязателен.' });
    return;
  }

  const doctorId   = req.query.doctor_id ? Number(req.query.doctor_id) : undefined;
  const categoryIds = parseIds(req.query.category_ids as string | undefined);

  let services = SERVICES.filter((s) => s.lpu_id === lpuId);
  if (doctorId !== undefined && Number.isFinite(doctorId)) {
    services = services.filter((s) => s.doctor_ids.includes(doctorId));
  }
  if (categoryIds.length > 0) {
    services = services.filter((s) => categoryIds.includes(s.category_id));
  }

  // Не выдаём mock-only поле lpu_id наружу (его в реальном API нет — оно в обёртке).
  const responseServices = services.map(({ lpu_id: _lpuId, ...rest }) => rest);

  res.json({
    count: responseServices.length,
    num_pages: 1,
    links: { next: null, previous: null },
    data: { lpu_id: lpuId, services: responseServices },
  });
});

// ── GET /schedule/lpu/ ────────────────────────────────────────────────────────

app.get('/schedule/lpu/', (req: Request, res: Response) => {
  const lpuIds   = parseIds(req.query.lpu_ids as string | undefined);
  const dateStart = (req.query.date_start as string | undefined) ?? today();
  const days     = req.query.days ? Math.min(Number(req.query.days), 30) : 14;

  if (lpuIds.length === 0) {
    res.status(400).json({ detail: 'Параметр lpu_ids обязателен.' });
    return;
  }

  const schedule = buildSchedule({ lpuIds, dateStart, days });
  res.json(page(schedule, schedule.length));
});

// ── GET /schedule/ (v2, с геофильтрацией) ────────────────────────────────────
// Маршрутизируем на ту же логику — townId/districtId игнорируем в mock

app.get('/schedule/', (req: Request, res: Response) => {
  const lpuIds   = parseIds(req.query.lpu_ids as string | undefined);
  const dateStart = (req.query.date_start as string | undefined) ?? today();
  const days     = req.query.days ? Math.min(Number(req.query.days), 30) : 14;

  // Если lpu_ids не задан — берём все клиники с поддержкой online-записи
  const ids = lpuIds.length > 0
    ? lpuIds
    : LPUS.filter((l) => l.direct_appointment_is_supported).map((l) => l.id);

  const schedule = buildSchedule({ lpuIds: ids, dateStart, days });
  res.json(page(schedule, schedule.length));
});

// ── POST /direct_appointment/doctor/execute/ ──────────────────────────────────

app.post('/direct_appointment/doctor/execute/', (req: Request, res: Response) => {
  const body = req.body as {
    doctor?: { id?: number; lpu_id?: number; speciality_id?: number };
    appointment?: { dt_start?: string; dt_end?: string; price?: number; comment?: string };
    client?: {
      first_name?: string;
      last_name?: string;
      second_name?: string;
      mobile_phone?: string;
      birthday?: string;
    };
  };

  const doctor      = body.doctor      ?? {};
  const appointment = body.appointment ?? {};
  const client      = body.client      ?? {};

  // ── Валидация обязательных полей ──────────────────────────────────────────

  const missing: string[] = [];
  if (!doctor.id)             missing.push('doctor.id');
  if (!doctor.lpu_id)         missing.push('doctor.lpu_id');
  if (!doctor.speciality_id)  missing.push('doctor.speciality_id');
  if (!appointment.dt_start)  missing.push('appointment.dt_start');
  if (!appointment.dt_end)    missing.push('appointment.dt_end');
  if (appointment.price === undefined) missing.push('appointment.price');
  if (!client.first_name)     missing.push('client.first_name');
  if (!client.last_name)      missing.push('client.last_name');
  if (!client.mobile_phone)   missing.push('client.mobile_phone');
  if (!client.birthday)       missing.push('client.birthday');

  if (missing.length > 0) {
    res.status(400).json({ detail: `Обязательные поля отсутствуют: ${missing.join(', ')}` });
    return;
  }

  // ── Эмуляция ошибок через comment ──────────────────────────────────────────
  // Формат: [ERROR:NNN] в поле comment

  const comment = appointment.comment ?? '';
  const errorMatch = comment.match(/\[ERROR:(\d{3})\]/i);
  if (errorMatch) {
    const code = Number(errorMatch[1]);
    const messages: Record<number, string> = {
      400: 'Неверные параметры записи.',
      401: 'Ошибка авторизации.',
      403: 'Запись для данного пациента запрещена.',
      409: 'На данное время уже существует запись.',
      423: 'Слот заблокирован. Пожалуйста, выберите другое время.',
      429: 'Превышен лимит запросов. Повторите попытку через минуту.',
      500: 'Внутренняя ошибка сервера.',
    };
    console.log(`[MOCK] Simulating error ${code} for booking (triggered by comment)`);
    res.status(code).json({ detail: messages[code] ?? `Ошибка ${code}` });
    return;
  }

  // ── Проверка существования врача и клиники ─────────────────────────────────

  const docDef = DOCTORS.find((d) => d.id === doctor.id);
  if (!docDef) {
    res.status(400).json({ detail: `Врач с id=${doctor.id} не найден.` });
    return;
  }
  if (!docDef.lpus.includes(doctor.lpu_id!)) {
    res.status(400).json({ detail: `Врач ${doctor.id} не работает в клинике ${doctor.lpu_id}.` });
    return;
  }

  // ── Проверка формата телефона ──────────────────────────────────────────────

  const phone = client.mobile_phone!.replace(/\D/g, '');
  if (phone.length !== 11) {
    res.status(400).json({ detail: 'Неверный формат телефона. Ожидается 11 цифр (79XXXXXXXXX).' });
    return;
  }

  // ── Проверка конфликта: 409 если слот уже занят ────────────────────────────

  if (isSlotBooked(doctor.id!, doctor.lpu_id!, appointment.dt_start!)) {
    res.status(409).json({ detail: 'На данное время уже существует активная запись к этому врачу.' });
    return;
  }

  // ── Проверка что слот в будущем ───────────────────────────────────────────

  const slotDate = new Date(appointment.dt_start!.replace(' ', 'T'));
  if (slotDate <= new Date()) {
    res.status(400).json({ detail: 'Нельзя записаться на прошедшее время.' });
    return;
  }

  // ── Создание записи ───────────────────────────────────────────────────────

  const rec = createAppointment({
    doctor_id: doctor.id!,
    lpu_id: doctor.lpu_id!,
    speciality_id: doctor.speciality_id!,
    dt_start: appointment.dt_start!,
    dt_end: appointment.dt_end!,
    price: appointment.price!,
    comment: appointment.comment,
    client: {
      first_name: client.first_name!,
      last_name: client.last_name!,
      second_name: client.second_name ?? '',
      mobile_phone: phone,
      birthday: client.birthday!,
    },
  });

  console.log(`[MOCK] Appointment created: ${rec.uuid} (${rec.dt_start}, doctor=${rec.doctor_id}, lpu=${rec.lpu_id})`);

  res.status(201).json({ claim_id: rec.uuid });
});

// ── POST /direct_appointment/doctor/cancel/ ───────────────────────────────────

app.post('/direct_appointment/doctor/cancel/', (req: Request, res: Response) => {
  const { uuid } = req.body as { uuid?: string };

  if (!uuid) {
    res.status(400).json({ detail: 'Поле uuid обязательно.' });
    return;
  }

  const ok = cancelAppointment(uuid);
  if (!ok) {
    res.status(404).json({ detail: `Запись с uuid=${uuid} не найдена.` });
    return;
  }

  console.log(`[MOCK] Appointment cancelled: ${uuid}`);
  res.status(204).send();
});

// ── GET /direct_appointment/history/ ─────────────────────────────────────────

app.get('/direct_appointment/history/', (req: Request, res: Response) => {
  const mobilePhone = req.query.mobile_phone as string | undefined;
  const lpuId       = req.query.lpu_id    ? Number(req.query.lpu_id)    : undefined;
  const doctorId    = req.query.doctor_id ? Number(req.query.doctor_id) : undefined;
  const dateStart   = req.query.date_start as string | undefined;
  const dateEnd     = req.query.date_end   as string | undefined;
  const uuid        = req.query.uuid       as string | undefined;
  const size        = req.query.size ? Number(req.query.size) : 50;
  // includeCanceled=true чтобы история пациента показывала отменённые записи тоже
  const includeCanceled = req.query.include_canceled === 'true';

  const records = getHistory({ mobilePhone, lpuId, doctorId, dateStart, dateEnd, uuid, includeCanceled });

  // Маппируем в формат MfAppointmentHistory
  const data = records.slice(0, size).map((a) => {
    const doc = DOCTORS.find((d) => d.id === a.doctor_id);
    const lpu = LPUS.find((l) => l.id === a.lpu_id);
    const specId = a.speciality_id;
    const specName = SPECIALITIES.find((s) => s.id === specId)?.name ?? `Специальность #${specId}`;

    return {
      id: a.id,
      uuid: a.uuid,
      date: a.dt_start.slice(0, 10),
      time_start: a.dt_start.slice(11) + ':00',  // "HH:MM:SS"
      time_end:   a.dt_end.slice(11) + ':00',
      price: a.price,
      canceled: a.canceled,
      lpu: {
        id: a.lpu_id,
        name: lpu?.name ?? `Клиника #${a.lpu_id}`,
        address: lpu?.address ?? '',
      },
      doctor: {
        id: a.doctor_id,
        fio: doc?.efio ?? `Врач #${a.doctor_id}`,
        speciality_id: specId,
        speciality_name: specName,
      },
      patient: a.client,
    };
  });

  res.json(page(data, records.length));
});

// ── 404 ───────────────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ detail: 'Ресурс не найден.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\nMedFlex Mock API запущен на http://localhost:${PORT}`);
  console.log('─'.repeat(60));
  console.log(`Специальностей : ${SPECIALITIES.length}`);
  console.log(`Клиник         : ${LPUS.length}`);
  console.log(`Врачей         : ${DOCTORS.length}`);
  console.log('─'.repeat(60));
  console.log('Чтобы эмулировать ошибку — передайте в comment при записи:');
  console.log('  [ERROR:409] — конфликт записи');
  console.log('  [ERROR:423] — слот заблокирован');
  console.log('  [ERROR:400] — некорректный запрос');
  console.log('  [ERROR:500] — ошибка сервера');
  console.log('─'.repeat(60));
  console.log();
});
