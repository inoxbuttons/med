-- ============================================================
-- Миграция 008: XXI Век Таганрог — сеть клиник, врачи, услуги
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Новые поля в таблице services
-- ---------------------------------------------------------------------------
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS stationary       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_booking     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS at_doctor_visit  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_from       BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2. Вспомогательные временные таблицы
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _clinic_map (key TEXT PRIMARY KEY, id INTEGER);
CREATE TEMP TABLE _spec_map   (name TEXT PRIMARY KEY, id INTEGER);

-- ---------------------------------------------------------------------------
-- 3. Сеть клиник XXI Век (Таганрог)
-- ---------------------------------------------------------------------------
INSERT INTO clinic_nets (name, description, website, mis)
VALUES ('XXI Век', 'Сеть многопрофильных клиник в Таганроге', 'https://med21vek.com', NULL);

INSERT INTO clinics (clinic_net_id, name, address)
SELECT id, '21 Век на Русском поле', 'Таганрог, ул. Чехова, 357А' FROM clinic_nets WHERE name = 'XXI Век';

INSERT INTO clinics (clinic_net_id, name, address)
SELECT id, '21 Век на Северном', 'Таганрог, Бакинский пр-д, 15' FROM clinic_nets WHERE name = 'XXI Век';

INSERT INTO _clinic_map SELECT 'На русском поле', id FROM clinics WHERE name = '21 Век на Русском поле';
INSERT INTO _clinic_map SELECT 'На северном',     id FROM clinics WHERE name = '21 Век на Северном';

-- ---------------------------------------------------------------------------
-- 4. Новые направления медицины
-- ---------------------------------------------------------------------------
INSERT INTO med_fields (name) VALUES ('Алгология') ON CONFLICT (name) DO NOTHING;
INSERT INTO med_fields (name) VALUES ('Анестезиология') ON CONFLICT (name) DO NOTHING;
INSERT INTO med_fields (name) VALUES ('Маммография') ON CONFLICT (name) DO NOTHING;
INSERT INTO med_fields (name) VALUES ('Нефрология') ON CONFLICT (name) DO NOTHING;
INSERT INTO med_fields (name) VALUES ('Пульмонология') ON CONFLICT (name) DO NOTHING;
INSERT INTO med_fields (name) VALUES ('Рентген') ON CONFLICT (name) DO NOTHING;
INSERT INTO med_fields (name) VALUES ('Травматология') ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Специализации врачей
-- ---------------------------------------------------------------------------
WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Акушер-гинеколог', id FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Акушер-гинеколог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Акушер-гинеколог, врач ультразвуковой диагностики', id FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Акушер-гинеколог, врач ультразвуковой диагностики', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Аллерголог-иммунолог', id FROM med_fields WHERE name = 'Аллергология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Аллерголог-иммунолог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Анестезиолог - реаниматолог', id FROM med_fields WHERE name = 'Анестезиология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Анестезиолог - реаниматолог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Врач УЗИ, детский врач УЗИ', id FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Врач УЗИ, детский врач УЗИ', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Врач акушер-гинеколог', id FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Врач акушер-гинеколог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Врач ультразвуковой диагностики', id FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Врач ультразвуковой диагностики', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Врач-алголог, специалист по лечению боли. Заведующий отде...', id FROM med_fields WHERE name = 'Алгология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Врач-алголог, специалист по лечению боли. Заведующий отде...', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Врач-дерматовенеролог', id FROM med_fields WHERE name = 'Дерматология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Врач-дерматовенеролог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Врач-невролог', id FROM med_fields WHERE name = 'Невропатология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Врач-невролог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Врач-невролог, эпилептолог', id FROM med_fields WHERE name = 'Невропатология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Врач-невролог, эпилептолог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Врач-рентгенолог, заведующий отделением лучевой диагностики', id FROM med_fields WHERE name = 'Рентген'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Врач-рентгенолог, заведующий отделением лучевой диагностики', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Врач-терапевт', id FROM med_fields WHERE name = 'Терапия'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Врач-терапевт', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Врач-эндоскопист', id FROM med_fields WHERE name = 'Эндоскопия'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Врач-эндоскопист', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Гастроэнтеролог', id FROM med_fields WHERE name = 'Гастроэнтерология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Гастроэнтеролог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Гастроэнтеролог, эндокринолог, терапевт', id FROM med_fields WHERE name = 'Гастроэнтерология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Гастроэнтеролог, эндокринолог, терапевт', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Гинеколог', id FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Гинеколог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Дерматовенеролог', id FROM med_fields WHERE name = 'Дерматология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Дерматовенеролог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Детский врач-гинеколог, врач ультразвуковой диагностики', id FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Детский врач-гинеколог, врач ультразвуковой диагностики', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Кандидат медицинских наук Урология, андрология, урогинекологи...', id FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Кандидат медицинских наук Урология, андрология, урогинекологи...', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Кардиолог', id FROM med_fields WHERE name = 'Кардиология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Кардиолог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Невролог', id FROM med_fields WHERE name = 'Невропатология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Невролог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Нефролог, Кандидат медицинских наук, Доцент РостГМУ', id FROM med_fields WHERE name = 'Нефрология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Нефролог, Кандидат медицинских наук, Доцент РостГМУ', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Онколог, маммолог, онколог-маммолог Врач первой категории', id FROM med_fields WHERE name = 'Маммография'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Онколог, маммолог, онколог-маммолог Врач первой категории', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Оперирующий гинеколог', id FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Оперирующий гинеколог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Оперирующий проктолог', id FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Оперирующий проктолог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Оперирующий уролог', id FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Оперирующий уролог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Оперирующий уролог, онкоуролог', id FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Оперирующий уролог, онкоуролог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Оперирующий хирург', id FROM med_fields WHERE name = 'Хирургия'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Оперирующий хирург', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Оперирующий хирург-гинеколог', id FROM med_fields WHERE name = 'Хирургия'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Оперирующий хирург-гинеколог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Ортопед, Артролог, Травматолог', id FROM med_fields WHERE name = 'Травматология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Ортопед, Артролог, Травматолог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Отоларинголог, ЛОР-хирург', id FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Отоларинголог, ЛОР-хирург', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Оториноларинголог', id FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Оториноларинголог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Офтальмолог', id FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Офтальмолог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Терапевт, кардиолог', id FROM med_fields WHERE name = 'Кардиология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Терапевт, кардиолог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Терапевт, пульмонолог', id FROM med_fields WHERE name = 'Пульмонология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Терапевт, пульмонолог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Травматолог, ортопед Ассоциация травматологов – ортопедов Ро...', id FROM med_fields WHERE name = 'Травматология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Травматолог, ортопед Ассоциация травматологов – ортопедов Ро...', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Ультразвуковая диагностика', id FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Ультразвуковая диагностика', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Хирург, эндоскопист Врач высшей категории', id FROM med_fields WHERE name = 'Хирургия'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Хирург, эндоскопист Врач высшей категории', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Хирург-флеболог, врач ультразвуковой диагностики', id FROM med_fields WHERE name = 'Сосудистая хирургия'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Хирург-флеболог, врач ультразвуковой диагностики', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Эндокринолог', id FROM med_fields WHERE name = 'Эндокринология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Эндокринолог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Эндокринолог, диетолог', id FROM med_fields WHERE name = 'Эндокринология'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Эндокринолог, диетолог', id FROM _s;

WITH _s AS (
  INSERT INTO specialities (name, med_field_id)
  SELECT 'Эндоскопист', id FROM med_fields WHERE name = 'Эндоскопия'
  RETURNING id
)
INSERT INTO _spec_map SELECT 'Эндоскопист', id FROM _s;

-- ---------------------------------------------------------------------------
-- 6. Врачи
-- ---------------------------------------------------------------------------
WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Абасов Адам Сафарбиевич', id FROM _spec_map WHERE name = 'Эндоскопист'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, NULL FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Аджатян Альбина Хасиновна', id FROM _spec_map WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Алибеков Тельман Демирбекович', id FROM _spec_map WHERE name = 'Анестезиолог - реаниматолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, NULL FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Амегнину Мессан Жак Карлос', id FROM _spec_map WHERE name = 'Хирург-флеболог, врач ультразвуковой диагностики'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 3000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Василевский Константин Анатольевич', id FROM _spec_map WHERE name = 'Оперирующий уролог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Ватулина Наталья Владимировна', id FROM _spec_map WHERE name = 'Гинеколог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2900 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Галушкин Александр Алексеевич', id FROM _spec_map WHERE name = 'Нефролог, Кандидат медицинских наук, Доцент РостГМУ'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 3000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Давыдов Денис Витальевич', id FROM _spec_map WHERE name = 'Отоларинголог, ЛОР-хирург'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2500 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Елисеева Эльвира Геннадьевна', id FROM _spec_map WHERE name = 'Врач ультразвуковой диагностики'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Занимонец Петр Юрьевич', id FROM _spec_map WHERE name = 'Оперирующий проктолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1800 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Зиновьева Татьяна Валерьевна', id FROM _spec_map WHERE name = 'Врач ультразвуковой диагностики'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Золотько Александра Александровна', id FROM _spec_map WHERE name = 'Кардиолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2300 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Ибрагимов Ризван Саралиевич', id FROM _spec_map WHERE name = 'Врач УЗИ, детский врач УЗИ'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Иващенко Ольга Евгеньевна', id FROM _spec_map WHERE name = 'Акушер-гинеколог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2100 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Икиликян Артур Мкртичевич', id FROM _spec_map WHERE name = 'Врач-рентгенолог, заведующий отделением лучевой диагностики'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, NULL FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Ильина Виктория Владимировна', id FROM _spec_map WHERE name = 'Врач-дерматовенеролог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Исмаилов Руслан Самедович', id FROM _spec_map WHERE name = 'Кандидат медицинских наук Урология, андрология, урогинекологи...'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 3000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Камбаров Жамол Камилжанович', id FROM _spec_map WHERE name = 'Оториноларинголог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1600 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Карапетян Инга Борисовна', id FROM _spec_map WHERE name = 'Акушер-гинеколог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Карпенко Иван Иванович', id FROM _spec_map WHERE name = 'Врач-эндоскопист'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, NULL FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Касумов Гаджи Шевкетович', id FROM _spec_map WHERE name = 'Терапевт, кардиолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1500 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Куликова (Аполихина) Елена Валерьевна', id FROM _spec_map WHERE name = 'Оперирующий проктолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1900 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Куликова Ольга Михайловна', id FROM _spec_map WHERE name = 'Невролог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2300 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Лаврухина Татьяна Васильевна', id FROM _spec_map WHERE name = 'Оториноларинголог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1600 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Ли Анна Александровна', id FROM _spec_map WHERE name = 'Дерматовенеролог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Лицкевич Оксана Васильевна', id FROM _spec_map WHERE name = 'Врач ультразвуковой диагностики'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Марайкин Владимир Олегович', id FROM _spec_map WHERE name = 'Кардиолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2300 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Матяшова Екатерина Алексеевна', id FROM _spec_map WHERE name = 'Врач акушер-гинеколог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Минченко Юрий Владимирович', id FROM _spec_map WHERE name = 'Хирург, эндоскопист Врач высшей категории'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1900 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Митичкин Андрей Владимирович', id FROM _spec_map WHERE name = 'Врач-алголог, специалист по лечению боли. Заведующий отде...'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 4000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Митясова Дарья Владимировна', id FROM _spec_map WHERE name = 'Эндокринолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2500 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Нестерова Инна Ивановна', id FROM _spec_map WHERE name = 'Гастроэнтеролог, эндокринолог, терапевт'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 3500 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Николаевский Дмитрий Сергеевич', id FROM _spec_map WHERE name = 'Травматолог, ортопед Ассоциация травматологов – ортопедов Ро...'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2500 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Пастух Дарья Алексеевна', id FROM _spec_map WHERE name = 'Детский врач-гинеколог, врач ультразвуковой диагностики'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Поколева Юлия Анатольевна', id FROM _spec_map WHERE name = 'Аллерголог-иммунолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2500 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Попович Диана Николаевна', id FROM _spec_map WHERE name = 'Акушер-гинеколог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Поротникова Карина Вячеславовна', id FROM _spec_map WHERE name = 'Онколог, маммолог, онколог-маммолог Врач первой категории'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Проскурина Светлана Тимофеевна', id FROM _spec_map WHERE name = 'Офтальмолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1800 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Савченко Илона Олеговна', id FROM _spec_map WHERE name = 'Врач-терапевт'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1500 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Саргсян Ася Ашотовна', id FROM _spec_map WHERE name = 'Кардиолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2300 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Седова Елена Сергеевна', id FROM _spec_map WHERE name = 'Акушер-гинеколог, врач ультразвуковой диагностики'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Стариенко Анна Сергеевна', id FROM _spec_map WHERE name = 'Врач-невролог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2400 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Стариенко Антон Дмитриевич', id FROM _spec_map WHERE name = 'Врач-терапевт'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1500 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Стрельников Алексей Владимирович', id FROM _spec_map WHERE name = 'Ортопед, Артролог, Травматолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2500 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Тен Николай Сергеевич', id FROM _spec_map WHERE name = 'Оперирующий уролог, онкоуролог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 3000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Тепикина Екатерина Александровна', id FROM _spec_map WHERE name = 'Гастроэнтеролог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Фурсов Семен Сергеевич', id FROM _spec_map WHERE name = 'Офтальмолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1800 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Хачумова Анна Витальевна', id FROM _spec_map WHERE name = 'Эндокринолог, диетолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 3000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Шанько Наталья Владимировна', id FROM _spec_map WHERE name = 'Терапевт, пульмонолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Шаповалов Богдан Игоревич', id FROM _spec_map WHERE name = 'Оперирующий гинеколог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Шипилов Антон Валерьевич', id FROM _spec_map WHERE name = 'Оперирующий хирург'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 1900 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Щеглова Таисия Игоревна', id FROM _spec_map WHERE name = 'Врач ультразвуковой диагностики'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, NULL FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Щербин Сергей Васильевич', id FROM _spec_map WHERE name = 'Оперирующий хирург-гинеколог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2500 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _d AS (
  INSERT INTO doctors (name, speciality_id)
  SELECT 'Яцук Анастасия Николаевна', id FROM _spec_map WHERE name = 'Врач-невролог, эпилептолог'
  RETURNING id
)
INSERT INTO doctor_locations (doctor_id, clinic_id, price)
SELECT _d.id, cm.id, 2000 FROM _d CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

-- ---------------------------------------------------------------------------
-- 7. Услуги
-- ---------------------------------------------------------------------------
WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-аллерголога-иммунолога первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Аллергология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-аллерголога-иммунолога повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Аллергология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2100 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-гастроэнтеролога первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Гастроэнтерология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация, комплексный прием) врача-терапевта, гастроэнтеролога, эндокринолога Нестеровой И.И. первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Гастроэнтерология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация, комплексный прием) врача-терапевта, гастроэнтеролога, эндокринолога Нестеровой И.И. повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Гастроэнтерология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-гастроэнтеролога повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Гастроэнтерология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1800 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Биопсия тканей матки (шейки матки)', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 4800 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Пайпель-биопсия', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 4500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление полипа шейки матки', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 4000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача Щербин С.В.', id, false, true, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-акушера-гинеколога первичный Ватулина Н.В.', id, false, true, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2900 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-акушера-гинеколога повторный Ватулина Н.В.', id, false, true, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача Щербин С.В. (по направлению от врача XXI век)', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-акушера-гинеколога первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-акушера-гинеколога повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1800 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Консультация Иващенко О.Е.', id, false, true, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Консультация Ватулина Н.В.', id, false, true, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием п/о пациентов врача Щербин С.В.', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Предоперационная консультация врача-гинеколога (Шаповалов Б.И.)', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Введение внутриматочной спирали Мирена', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Радиоволновая конизация / эксцизия шейки матки', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 9000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаления множественных кондилом', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Плазмолифтинг', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-акушера-гинеколога Иващенко О.Е. первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2100 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-акушера-гинеколога Иващенко О.Е. повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1600 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Повторный прием (осмотр, консультация) врача Щербин С.В.', id, false, true, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Перинеометрия', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Подбор акушерского (гинекологического) пессария', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Соногистеросальпингоскопия', id, false, false, false, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 8500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Кольпотест', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 150 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Выскабливание цервикального канала', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление акушерского (гинекологического) пессария', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Введение акушерского (гинекологического) пессария', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Снятие швов, скоб (Гинекология)', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1200 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Кардиотокография плода', id, false, false, false, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 600 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Бужирование цервикального канала', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1700 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление кондиломы', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление внутриматочной спирали', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Введение внутриматочной спирали', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Аргоноплазменная аблация ш/матки', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 7000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Радиоволновая коагуляция ш/матки', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 6000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Кольпоскопия', id, false, false, true, false
  FROM med_fields WHERE name = 'Гинекология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-дерматовенеролога первичный (Ильина В.В.)', id, false, true, true, false
  FROM med_fields WHERE name = 'Дерматология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-дерматовенеролога повторный (Ильина В.В.)', id, false, true, true, false
  FROM med_fields WHERE name = 'Дерматология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1700 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-дерматовенеролога первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Дерматология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-дерматовенеролога повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Дерматология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1700 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Велоэргометрия (диагностическое исследование)', id, false, false, false, false
  FROM med_fields WHERE name = 'Кардиология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-кардиолога повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Кардиология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1900 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-кардиолога первичный (осмотр + экг)', id, false, true, true, false
  FROM med_fields WHERE name = 'Кардиология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2300 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ритмограмма (доплата)', id, false, false, false, false
  FROM med_fields WHERE name = 'Кардиология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 100 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление серных пробок (1 ухо)', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 350 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вакуумное промывание миндалин аппаратом Тонзилор-М', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 800 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Парацентез барабанной перепонки', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-оториноларинголога первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1600 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-оториноларинголога повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1400 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Профилактический осмотр перед процедурой, с анемизацией', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 600 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Тампонада носа', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 800 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие отогематом', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Носовой Душ', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 700 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие паратонзиллярного абсцесса', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Гальваноакустика кровоточащих сосудов в полости носа', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Полипэктомия уха, носа', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 6500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Рассечение синехий в полости носа', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление атером в области лица 1 категории сложности', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление атером в области лица 2 категории сложности', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 8000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление атером в области лица 3 категории сложности', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 10000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление доброкачественной папилломы небной миндалины', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Пункция гайморовой пазухи с промыванием', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Эндоскопия ЛОР-органов', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Биопсия опухолей уха', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Анемизация слизистой носа', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 300 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Биопсия полости носа', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Коагуляция кровеносных сосудов Лор-органов', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Биопсия гортани', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие фурункула наружного слухового прохода', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 4000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие атеромы ушного канала', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5100 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление инородного тела (одна зона) III к/с', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление инородного тела (одна зона) II к/с', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление инородного тела (одна зона) I к/с', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Турунда с лекарственным средством (одно ухо)', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 200 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие кисты небной миндалины', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Туалет слухового прохода', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 200 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Внутригортанные вливания', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 350 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Продувание слуховых труб', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 300 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Промывание верхнечелюстных пазух через дренажи (1 трубка) физ. р-ром', id, false, false, true, false
  FROM med_fields WHERE name = 'ЛОР'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-офтальмолога первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1800 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Подбор очков', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Подбор очковой коррекции зрения', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-офтальмолога повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1600 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Офтальмотонометрия (измерение в/глаз. давления по Маклакову)', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Зондирование слезных каналов', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 550 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Биомикроскопия глаза', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 550 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Определение рефракции с помощью набора пробных линз', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 200 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление инородного тела из склеры', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 550 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Инъекция подконъюктивальная (1 глаз)', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 400 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Инъекция парабульбарная (1 глаз)', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 400 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление роговидных и подконъюктивальных инородных тел', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Массаж век офтальмологический (один сеанс)', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Рефрактометрия', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 200 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Исследование аккомодации', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 150 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Исследование цветоощущения', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 150 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Периметрия (исследование поля зрения)', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 400 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Офтальмоскопия (осмотр глазного дна)', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 250 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Офтальмотонометрия (измерение в/глаз. давления)', id, false, false, true, false
  FROM med_fields WHERE name = 'Офтальмология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 250 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ректороманоскопия', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лигирование геморроидальных узлов – 1 узел', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 8000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-колопроктолога первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1800 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-колопроктолога повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-колопроктолога Занимонец П.Ю.', id, false, true, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1800 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Электрокоагуляция кондилом, папиллом до 5 шт в размере до 1 см в диаметре', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие абсцесса копчикогово хода 1 к/с', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 15000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие абсцесса копчикогово хода 2к/с', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Малоинвазивное иссечение копчикового хода с пластикой 1 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Малоинвазивное иссечение копчикового хода с пластикой 2 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление наружного геморроидального узла 1 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление гипертрофированного анального сосочка (фиброзный полип) 2к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление гипертрофированного анального сосочка (фиброзный полип) 3к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Биопсия перианальной кожи', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Перианальная блокада', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лазерная вапоризация геморроидальных узлов 1 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 45000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лазерная вапоризация геморроидальных узлов 2 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лазерная вапоризация геморроидальных узлов 3 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 55000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лазерная вапоризация 1 геморроидального узла', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лечение копчикового хода с использованием лазера 1 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 35000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лечение копчикового хода с использованием лазера 2 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лечение копчикового хода с использованием лазера 3 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 45000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление анальной трещины с использованием лазера 2 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие, дренирование острого подкожного парапрактита 3 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение анальной трещины радиоволновым скальпелем 1 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 35000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение анальной трещины радиоволновым скальпелем 2 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление тромбированного геморроидального узла 1 к/с', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление тромбированного геморроидального узла 2 к/с', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление комбинированного геморроидального узла', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Биопсия ануса и перианальной области', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Химическая сфинктеротомия (введение ботулинического токсина)', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 15000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Склеротерапия геморроидальных узлов – 1 узел', id, false, false, true, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 8000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление анальной трещины с использованием лазера 1 к/с', id, false, false, false, false
  FROM med_fields WHERE name = 'Проктология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 45000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Консультация врача-флеболога первичная', id, false, true, true, false
  FROM med_fields WHERE name = 'Сосудистая хирургия'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-сосудистого хирурга первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Сосудистая хирургия'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-сосудистого хирурга повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Сосудистая хирургия'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1800 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация, комплексный прием) врача-терапевта, гастроэнтеролога, эндокринолога Нестеровой И.И.', id, false, true, true, false
  FROM med_fields WHERE name = 'Терапия'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-терапевта первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Терапия'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-терапевта повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Терапия'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1300 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация, комплексный прием) врача-терапевта, гастроэнтеролога, эндокринолога Нестеровой И.И. повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Терапия'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование щитовидной железы', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование почек', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование почки (одной)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 750 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование мошонки', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование беременности до 12 недель', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование беременности 14-18 недель без ДПМ', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2100 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование беременности 22-40 недель', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Эхокардиография плода (20-22 недели)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование вен нижней конечности (1 нога)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование сосудов шеи (БЦА)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование коленного сустава (один)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование коленных суставов (два)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование плечевого сустава (один)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1200 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование голеностопного сустава (один)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1100 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование голеностопных суставов (два)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1600 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование тазобедренных суставов (два)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование локтевого сустава (один)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1100 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование локтевых суставов (два)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1800 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование мочевого пузыря', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1200 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Нейросонография (до полугода)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Нейросонография (после полугода)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование плечевых суставов (два)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1800 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Допплерометрия плода', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1400 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Эхокардиография', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2200 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование фолликулогенеза', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование генетическое (эксперт) до 14 недель', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование шейки матки (УЗ-цервикометрия)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 600 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование вен нижних конечностей', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование молочных желез', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование простаты и остаточной мочи', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование плевральной полости', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 700 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование брюшной аорты и ее висцеральных ветвей', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование тазобедренного сустава (один)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование подвздошно-бедренного сегмента', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'УЗИ Определение объема околоплодных вод (ИАЖ)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 600 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование артерий почек', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'УЗИ лимфатических узлов (несколько групп)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование мочевыводящих путей', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1700 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Экспертное УЗИ сердца', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование предстательной железы трансректальное', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Определение пола ребенка (без дополнительных измерений)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 700 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование слюнных желез', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1300 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование одной молочной железы', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 900 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование мягких тканей (одна анатомическая зона)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1300 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование сосудов головы', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование вен верхней конечности (1 рука)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование вен верхних конечностей', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование артерий верхней конечности (1 рука)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование артерий верхних конечностей', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование артерий нижней конечности (1 нога)', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дуплексное сканирование артерий нижних конечностей', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Допплерометрия плода 20-40 недель', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1400 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование беременности 19-22 недели с ДПМ', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2300 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование малого таза', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1300 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Определение функции желчного пузыря', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 200 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование печени и желчного пузыря', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1200 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Ультразвуковое исследование брюшной полости', id, false, false, false, false
  FROM med_fields WHERE name = 'Ультразвуковая диагностика'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-уролога первичный Василевский К.А.', id, false, true, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-уролога повторный Василевский К.А.', id, false, true, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1600 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Замена цистостомы', id, false, false, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление катетера из верхних мочевыводящих путей', id, false, false, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Повторный прием (осмотр, консультация) врача-уролога Тен Н.С.', id, false, true, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача уролога-андролога Исмаилов Р.С.', id, false, true, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Снятие послеоперационных швов (лигатур)', id, false, false, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Замена катетера Пеццера, Фоллея', id, false, false, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Первичный прием (осмотр, консультация) врача-уролога Тен Н.С.', id, false, true, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием первичный врача-нефролога, КМН, Галушкин А.А.', id, false, true, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием повторный врача-нефролога, КМН, Галушкин А.А.', id, false, true, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Катетеризация мочевого пузыря у мужчин', id, false, false, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Катетеризация мочевого пузыря у женщин', id, false, false, true, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Урофлоурометрия (измерение скорости потока мочи )', id, false, false, false, false
  FROM med_fields WHERE name = 'Урология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-хирурга первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Хирургия'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1900 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-хирурга повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Хирургия'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 1700 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Наложение швов', id, false, false, true, false
  FROM med_fields WHERE name = 'Хирургия'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-эндокринолога Хачумова А.В.', id, false, true, true, false
  FROM med_fields WHERE name = 'Эндокринология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация) врача-эндокринолога', id, false, true, true, false
  FROM med_fields WHERE name = 'Эндокринология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация, комплексный прием) врача-терапевта, гастроэнтеролога, эндокринолога Нестеровой И.И. первичный', id, false, true, true, false
  FROM med_fields WHERE name = 'Эндокринология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Прием (осмотр, консультация, комплексный прием) врача-терапевта, гастроэнтеролога, эндокринолога Нестеровой И.И. повторный', id, false, true, true, false
  FROM med_fields WHERE name = 'Эндокринология'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление полипа влагалища', id, true, false, false, true
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие и дренирование абсцесса бартолиновой железы', id, true, false, false, true
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 7200 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Диагностическая лапароскопия', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лапароскопическая надвлагалищная ампутация матки', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 100000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Диагностическая гистероскопия с выскабливанием шейки матки', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Гистерорезектоскопия — коагуляция очагов аденомиоза, полипэктомия', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 35000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Гистерорезектоскопия — миомэктомия', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Надвлагалищная ампутация матки', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 75000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение кисты бартолиновой железы', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 35000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Экстирпация матки', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 85000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Абляция эндометрия', id, true, false, false, true
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Гистерорезектоскопия — множественных полипов или полип более 2 см', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 45000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Гистерорезектоскопия — миомэктомия узла более 2,5 см', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 55000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Круговая биопсия шейки матки', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 15000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление полипа шейки матки', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 8000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление послеоперационного рубца', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 8500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Участие в операции абдоминального хирурга при спаечном процессе', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 15000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Хирургическая лапароскопия 2 категории — сальпингостомия. фимбриолизис, эндокоагуляция эндометриоидный гетеротопий', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 65000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Хирургическая лапароскопия 3 категории — эндометриомэктомия, цистэктомия, миомэктомия, тубэктомия', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 75000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Выскабливание полости матки', id, true, false, false, true
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 15000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вагинальная гистерэктомия', id, true, false, false, true
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 105000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Контрастная эхогистеросальпингоскопия', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 10000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Медикаментозное прерывание неразвивающейся беременности малого срока', id, true, false, false, true
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 7500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Резекция в стационаре', id, true, false, false, true
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 8000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Экстирпация матки влагалищная', id, true, false, false, false
  FROM med_fields WHERE name = 'Гинекология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 95000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие абсцесса копчикогово хода 1 к/с', id, true, false, false, true
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 15000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Малоинвазивное иссечение копчикового хода с пластикой 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление тромбированного геморроидального узла 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Биопсия перианальной кожи', id, true, false, false, true
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Геморроидэктомия с использованием лазера 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 55000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие, дренирование острого подкожного парапроктита 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дезартеризация геморроидальных узлов с мукопексией 2к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 60000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Дезартеризация геморроидальных узлов с мукопексией 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение свища', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 45000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение анальной трещины радиоволновым скальпелем 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 45000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение анальной трещины радиоволновым скальпелем 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение анальной трещины 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 80000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение анальной трещины 3 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение перианальной кондиломы 1 шт.', id, true, false, false, true
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лазерная вапоризация 1 геморроидального узла', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лазерная вапоризация геморроидальных узлов 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 55000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лазерная вапоризация геморроидальных узлов 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 60000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лазерная вапоризация геморроидальных узлов 3 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 65000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лечение копчикового хода с использованием лазера 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лечение копчикового хода с использованием лазера 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 45000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лечение копчикового хода с использованием лазера 3 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Проведение дренирующей лигатуры при свищах анального канала 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Проведение дренирующей лигатуры при свищах анального канала 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Склеротерапия геморроидальных узлов', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление анальной трещины с использованием лазера 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 70000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление анальной трещины с использованием лазера 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление гипертрофированного анального сосочка (фиброзный полип) 3к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление гипертрофированного анального сосочка (фиброзный полип) 2к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 35000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление гипертрофированного анального сосочка (фиброзный полип) 1к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление наружного геморроидального узла 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление комбинированного геморроидального узла', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление узла с некрозом', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Участие приглашенного специалиста', id, true, false, false, true
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 8000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Подготовка операционной', id, true, false, false, true
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие абсцесса копчикогово хода 2к/с', id, true, false, false, true
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие, дренирование острого подкожного парапроктита 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Вскрытие, дренирование острого подкожного парапрактита 3 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 45000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Геморроидэктомия по Миллигану', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 55000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Геморроидэктомия с косметическим швом по Фергюссону', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Геморроидэктомия (Занимонец П.Ю.) с использованием лазера 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 65000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Малоинвазивное иссечение копчикового хода с пластикой 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление тромбированного геморроидального узла 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лечение рецедивирующего копчикового хода', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 75000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Химическая сфинктеротомия (введение бутолинического токсина)', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Онлайн сопровождение пациента (1 неделя)', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 10000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление комбинированного геморроидального узла с некрозом', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лечение хронической анальной трещины', id, true, false, false, false
  FROM med_fields WHERE name = 'Проктология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение кондилом полового члена', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 15000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'ТУР мочевого пузыря', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 70000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'ТУР простаты биполярный 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 75000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Контактная лазерная уретеролитотрипсия (Аппарат экспертного уровня «Dornier») КУЛТ', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 78000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Контактная лазерная перкутанная нефролитотрипсия (Аппарат экспертного класса «Dornier») ПКНЛ', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 87000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Установка нефростомы', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Стентирование мочеточника', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 47000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'ДЛТ 1 сеанс', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 15000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Пластика мочеточника (лапароскопическая)', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 70000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Орхиэктомия', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Полифокальная биопсия предстательной железы', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Аденомэктомия', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 100000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'ДЛТ (Дробление камней — 3 сеанса)', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 35000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение крайней плоти — I к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение крайней плоти — II к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение крайней плоти — III к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 35000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение липомы мошонки', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5600 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение парауретральной кисты под местной анестезией', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 2500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение полипа уретры', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение кисты почки 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 75000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лапароскопия почки', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 70000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лапароскопическая пластика ЛМС (почки)', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 37500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Литотрипсия (цистолитотрипсия)', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Меатотомия', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Нефропексия', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 70000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Нефростомия', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Чрескожная пункционная нефростомия', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 15000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Нефрэктомия', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 90000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Операции при варикоцеле 1 к/с (лапароскопия)', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 70000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Операции при варикоцеле Иванисевича', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Операции при варикоцеле Мармара', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 60000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Операция при гидроцеле', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Оптическая уретротомия', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Орхофуникулэктомия', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Букальная пластика уретры', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 115000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Пластика уретры (миатостеноз)', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 17000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Пластика уздечки полового члена', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 15000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Пункция кисты почки', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'РИРХ (ретроградная интраренальная хирургия)', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 135000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Стентирование мочеточника со стентом пациента', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 10000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Стентирование во время операции', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 10000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Снятие стента мочеточника', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 3000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление парауретральной кисты хирургически', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 10000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Удаление папиллом', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На русском поле', 'На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Уретеролитоэкстракция', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 30000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Уретеролитоэкстракция 1 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Уретеролитоэкстракция 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Уретроскопия', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Уретротомия', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 6000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Урография (стационар)', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 5000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Установка нефростомы с нашей трубкой', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 35000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Замена нефростомы с нашей трубкой', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 22000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Цистолитотомия', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 21500 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Цистолитоэкстракция 1 к/с', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 40000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Цистолитоэкстракция 2 к/с', id, true, false, false, true
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 50000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Цистоскопия 1 категории сложности', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 10000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Цистоскопия 2 категории сложности', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 15000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Цистостомия', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'ТУР простаты биполярный 2 к/с', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 85000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Лазерная цистолитотрипсия трансуретральная (совместно с ТУР простаты биполярный)', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 10000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Участие приглашенного специалиста', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Рассечение уретероцеле (лазер)', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 35000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Биполярное рассечение уретероцеле', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 25000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Пластика уретры', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 60000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Иссечение крайней плоти', id, true, false, false, false
  FROM med_fields WHERE name = 'Урология стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 20000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

WITH _sv AS (
  INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
  SELECT 'Нефропексия', id, true, false, false, true
  FROM med_fields WHERE name = 'Хирургия стационар'
  RETURNING id
)
INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT _sv.id, cm.id, 70000 FROM _sv CROSS JOIN _clinic_map cm WHERE cm.key IN ('На северном');

COMMIT;