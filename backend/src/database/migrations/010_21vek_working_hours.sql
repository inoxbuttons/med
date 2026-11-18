-- 010: расписание врачей сети «XXI Век» — по образцу сети 1.
-- Пн–Пт 09:00–18:00, Сб 09:00–15:00, слот 30 мин, без перерыва.
-- Врач в одной клинике — все 6 дней в ней.
-- Врач в двух клиниках — Пн–Ср в первой (меньший id), Чт–Сб во второй.
-- Идемпотентно: врачи, у которых уже есть расписание, пропускаются.

WITH net AS (
  SELECT id FROM clinic_nets WHERE name = 'XXI Век'
),
locs AS (
  SELECT dl.doctor_id,
         dl.clinic_id,
         ROW_NUMBER() OVER (PARTITION BY dl.doctor_id ORDER BY dl.clinic_id) AS rn,
         COUNT(*)     OVER (PARTITION BY dl.doctor_id)                       AS cnt
  FROM doctor_locations dl
  JOIN clinics c ON c.id = dl.clinic_id
  WHERE c.clinic_net_id = (SELECT id FROM net)
    AND NOT EXISTS (SELECT 1 FROM doctor_working_hours w WHERE w.doctor_id = dl.doctor_id)
),
days AS (
  SELECT d AS day_of_week,
         TIME '09:00' AS start_time,
         CASE WHEN d = 6 THEN TIME '15:00' ELSE TIME '18:00' END AS end_time
  FROM generate_series(1, 6) AS d
)
INSERT INTO doctor_working_hours (doctor_id, clinic_id, day_of_week, start_time, end_time, slot_duration, is_active)
SELECT l.doctor_id, l.clinic_id, days.day_of_week, days.start_time, days.end_time, 30, true
FROM locs l
JOIN days ON
     l.cnt = 1
  OR (l.rn = 1 AND days.day_of_week BETWEEN 1 AND 3)
  OR (l.rn = 2 AND days.day_of_week BETWEEN 4 AND 6)
ORDER BY l.doctor_id, days.day_of_week;
