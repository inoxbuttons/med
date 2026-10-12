-- =============================================================================
-- Миграция 007: release1 — вымышленные имена врачей, суббота, записи на месяц
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Переключить клинику на локальную БД (убрать MedFlex)
-- ---------------------------------------------------------------------------
UPDATE clinic_nets SET mis = NULL, medflex_key = NULL WHERE id = 1;

-- ---------------------------------------------------------------------------
-- 1a. Город: Таганрог → Санкт-Петербург
-- ---------------------------------------------------------------------------
UPDATE clinics SET address = REPLACE(address, 'г. Таганрог', 'г. Санкт-Петербург');

-- ---------------------------------------------------------------------------
-- 2. Переименовать врачей (оборудование ID 18, 24, 26 не трогаем)
-- ---------------------------------------------------------------------------
UPDATE doctors SET name = 'Иванов Александр Николаевич',    profile_url = '#' WHERE id = 1;
UPDATE doctors SET name = 'Петров Дмитрий Андреевич',       profile_url = '#' WHERE id = 2;
UPDATE doctors SET name = 'Сидорова Наталья Сергеевна',     profile_url = '#' WHERE id = 3;
UPDATE doctors SET name = 'Козлов Алексей Владимирович',    profile_url = '#' WHERE id = 4;
UPDATE doctors SET name = 'Смирнова Елена Борисовна',       profile_url = '#' WHERE id = 5;
UPDATE doctors SET name = 'Новиков Андрей Павлович',        profile_url = '#' WHERE id = 6;
UPDATE doctors SET name = 'Морозова Юлия Юрьевна',         profile_url = '#' WHERE id = 7;
UPDATE doctors SET name = 'Соколова Анна Ивановна',         profile_url = '#' WHERE id = 8;
UPDATE doctors SET name = 'Лебедев Роман Анатольевич',      profile_url = '#' WHERE id = 9;
UPDATE doctors SET name = 'Лебедева Ирина Анатольевна',     profile_url = '#' WHERE id = 10;
UPDATE doctors SET name = 'Попов Евгений Константинович',   profile_url = '#' WHERE id = 11;
UPDATE doctors SET name = 'Попова Алина Константиновна',    profile_url = '#' WHERE id = 12;
UPDATE doctors SET name = 'Кузнецов Артём Вячеславович',    profile_url = '#' WHERE id = 13;
UPDATE doctors SET name = 'Волков Николай Петрович',        profile_url = '#' WHERE id = 14;
UPDATE doctors SET name = 'Кузнецова Валентина Вячеславовна', profile_url = '#' WHERE id = 15;
UPDATE doctors SET name = 'Зайцев Денис Олегович',          profile_url = '#' WHERE id = 16;
UPDATE doctors SET name = 'Никитин Олег Михайлович',        profile_url = '#' WHERE id = 17;
UPDATE doctors SET name = 'Волкова Надежда Петровна',       profile_url = '#' WHERE id = 19;
UPDATE doctors SET name = 'Зайцева Виктория Олеговна',      profile_url = '#' WHERE id = 20;
UPDATE doctors SET name = 'Никитина Людмила Михайловна',    profile_url = '#' WHERE id = 21;
UPDATE doctors SET name = 'Орлова Ксения Дмитриевна',       profile_url = '#' WHERE id = 22;
UPDATE doctors SET name = 'Федорова Галина Леонидовна',     profile_url = '#' WHERE id = 23;
UPDATE doctors SET name = 'Орлов Василий Дмитриевич',       profile_url = '#' WHERE id = 25;
UPDATE doctors SET name = 'Федоров Геннадий Леонидович',    profile_url = '#' WHERE id = 27;
UPDATE doctors SET name = 'Захаров Станислав Николаевич',   profile_url = '#' WHERE id = 28;
UPDATE doctors SET name = 'Захарова Оксана Николаевна',     profile_url = '#' WHERE id = 29;
UPDATE doctors SET name = 'Егоров Кирилл Александрович',    profile_url = '#' WHERE id = 30;
UPDATE doctors SET name = 'Егорова Кристина Александровна', profile_url = '#' WHERE id = 31;
UPDATE doctors SET name = 'Ершова Полина Сергеевна',        profile_url = '#' WHERE id = 32;
UPDATE doctors SET name = 'Калинина Дарья Борисовна',       profile_url = '#' WHERE id = 33;
UPDATE doctors SET name = 'Громова Мария Викторовна',       profile_url = '#' WHERE id = 34;
UPDATE doctors SET name = 'Власова Екатерина Алексеевна',   profile_url = '#' WHERE id = 36;
UPDATE doctors SET name = 'Белова Вероника Игоревна',       profile_url = '#' WHERE id = 37;
UPDATE doctors SET name = 'Титова Жанна Михайловна',        profile_url = '#' WHERE id = 38;
UPDATE doctors SET name = 'Макарова Диана Николаевна',      profile_url = '#' WHERE id = 39;
UPDATE doctors SET name = 'Ершов Вадим Сергеевич',          profile_url = '#' WHERE id = 40;
UPDATE doctors SET name = 'Калинин Антон Борисович',        profile_url = '#' WHERE id = 41;
UPDATE doctors SET name = 'Романова Анастасия Юрьевна',     profile_url = '#' WHERE id = 42;
UPDATE doctors SET name = 'Крылова Лариса Андреевна',       profile_url = '#' WHERE id = 43;
UPDATE doctors SET name = 'Морозов Виктор Юрьевич',         profile_url = '#' WHERE id = 44;
UPDATE doctors SET name = 'Борисова Тамара Васильевна',     profile_url = '#' WHERE id = 45;
UPDATE doctors SET name = 'Петрова Светлана Андреевна',     profile_url = '#' WHERE id = 46;
UPDATE doctors SET name = 'Соколов Сергей Иванович',        profile_url = '#' WHERE id = 47;
UPDATE doctors SET name = 'Новиков Игорь Борисович',        profile_url = '#' WHERE id = 48;
UPDATE doctors SET name = 'Козлова Ольга Владимировна',     profile_url = '#' WHERE id = 49;
UPDATE doctors SET name = 'Новикова Татьяна Павловна',      profile_url = '#' WHERE id = 50;
UPDATE doctors SET name = 'Сидоров Михаил Сергеевич',       profile_url = '#' WHERE id = 51;
UPDATE doctors SET name = 'Иванова Марина Николаевна',      profile_url = '#' WHERE id = 52;

-- ---------------------------------------------------------------------------
-- 3. Субботнее расписание (копируем пятницу, укороченный день 09:00–15:00)
-- ---------------------------------------------------------------------------
INSERT INTO doctor_working_hours
    (doctor_id, clinic_id, day_of_week, start_time, end_time, slot_duration, is_active)
SELECT
    doctor_id, clinic_id, 6,
    '09:00'::time, '15:00'::time,
    slot_duration, true
FROM doctor_working_hours
WHERE day_of_week = 5
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Фиктивные пациенты (50 чел.)
-- ---------------------------------------------------------------------------
INSERT INTO persons (first_name, last_name, phone, birth_date) VALUES
('Алексей',   'Воронов',     '+79001110001', '1985-03-12'),
('Мария',     'Степанова',   '+79001110002', '1990-07-24'),
('Дмитрий',   'Крылов',      '+79001110003', '1978-11-05'),
('Ольга',     'Белкина',     '+79001110004', '1995-02-18'),
('Сергей',    'Громов',      '+79001110005', '1982-09-30'),
('Наталья',   'Тихонова',    '+79001110006', '1988-04-14'),
('Андрей',    'Фомин',       '+79001110007', '1975-06-22'),
('Татьяна',   'Ларина',      '+79001110008', '1992-01-09'),
('Павел',     'Сорокин',     '+79001110009', '1980-12-03'),
('Ирина',     'Медведева',   '+79001110010', '1987-08-17'),
('Михаил',    'Ковалёв',     '+79001110011', '1973-05-28'),
('Елена',     'Жукова',      '+79001110012', '1993-10-11'),
('Артём',     'Беляев',      '+79001110013', '1996-03-07'),
('Светлана',  'Кириллова',   '+79001110014', '1983-07-19'),
('Николай',   'Лазарев',     '+79001110015', '1970-01-25'),
('Анна',      'Осипова',     '+79001110016', '1998-11-30'),
('Игорь',     'Макаров',     '+79001110017', '1977-04-04'),
('Юлия',      'Семёнова',    '+79001110018', '1991-09-16'),
('Константин','Зуев',        '+79001110019', '1984-02-27'),
('Виктория',  'Панова',      '+79001110020', '1994-06-08'),
('Роман',     'Харитонов',   '+79001110021', '1979-08-21'),
('Ксения',    'Соловьёва',   '+79001110022', '1997-12-15'),
('Денис',     'Корнеев',     '+79001110023', '1986-03-03'),
('Людмила',   'Богданова',   '+79001110024', '1969-05-19'),
('Антон',     'Щербаков',    '+79001110025', '1990-10-07'),
('Галина',    'Трофимова',   '+79001110026', '1972-07-31'),
('Евгений',   'Мельников',   '+79001110027', '1989-01-14'),
('Валентина', 'Ефимова',     '+79001110028', '1965-09-22'),
('Владимир',  'Сергеев',     '+79001110029', '1981-11-18'),
('Диана',     'Захаркина',   '+79001110030', '1999-04-26'),
('Максим',    'Коновалов',   '+79001110031', '1993-08-09'),
('Вера',      'Зимина',      '+79001110032', '1976-02-12'),
('Тимур',     'Орехов',      '+79001110033', '1988-06-05'),
('Оксана',    'Дмитриева',   '+79001110034', '1971-10-28'),
('Алина',     'Рябова',      '+79001110035', '2000-03-17'),
('Станислав', 'Куликов',     '+79001110036', '1983-07-24'),
('Жанна',     'Миронова',    '+79001110037', '1992-12-01'),
('Руслан',    'Фёдоров',     '+79001110038', '1985-05-13'),
('Надежда',   'Горбунова',   '+79001110039', '1968-09-27'),
('Кирилл',    'Воробьёв',    '+79001110040', '1995-01-08'),
('Полина',    'Нестерова',   '+79001110041', '1997-04-22'),
('Вадим',     'Козлов',      '+79001110042', '1974-08-14'),
('Лариса',    'Третьякова',  '+79001110043', '1967-11-06'),
('Тамара',    'Широкова',    '+79001110044', '1963-03-29'),
('Борис',     'Зыков',       '+79001110045', '1978-07-17'),
('Марина',    'Савельева',   '+79001110046', '1991-02-03'),
('Геннадий',  'Лукьянов',    '+79001110047', '1960-06-11'),
('Вероника',  'Уварова',     '+79001110048', '1994-10-24'),
('Леонид',    'Маслов',      '+79001110049', '1987-01-18'),
('Христина',  'Журавлёва',   '+79001110050', '2001-05-30');

-- ---------------------------------------------------------------------------
-- 5. Очистить существующие записи (оставляем только прошлые, если есть)
-- ---------------------------------------------------------------------------
DELETE FROM appointments WHERE start_time >= CURRENT_DATE;

-- ---------------------------------------------------------------------------
-- 6. Случайные записи на ближайший месяц (~50 % заполнения)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  cur_date   DATE;
  dow        SMALLINT;
  rec        RECORD;
  slot_start TIMESTAMP;
  slot_end   TIMESTAMP;
  pid        INTEGER;
BEGIN
  FOR cur_date IN
    SELECT d::date
    FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '31 days', '1 day') d
  LOOP
    -- EXTRACT(DOW): 0=вс, 1=пн … 6=сб
    dow := EXTRACT(DOW FROM cur_date)::SMALLINT;
    IF dow = 0 THEN CONTINUE; END IF;  -- пропускаем воскресенье

    FOR rec IN
      SELECT dwh.doctor_id, dwh.clinic_id,
             dwh.start_time, dwh.end_time, dwh.slot_duration
      FROM doctor_working_hours dwh
      WHERE dwh.day_of_week = dow AND dwh.is_active = TRUE
    LOOP
      slot_start := cur_date + rec.start_time;
      slot_end   := slot_start + (rec.slot_duration || ' minutes')::INTERVAL;

      WHILE slot_end <= cur_date + rec.end_time LOOP
        IF random() < 0.5 THEN
          -- выбираем случайного пациента из только что вставленных
          SELECT id INTO pid
          FROM persons
          ORDER BY random()
          LIMIT 1;

          INSERT INTO appointments
            (doctor_id, clinic_id, start_time, end_time, patient_id, status, source)
          VALUES
            (rec.doctor_id, rec.clinic_id,
             slot_start, slot_end,
             pid, 'scheduled', 'web');
        END IF;

        slot_start := slot_end;
        slot_end   := slot_start + (rec.slot_duration || ' minutes')::INTERVAL;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
