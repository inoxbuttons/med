-- ============================================================
-- Migration 002: appointments table + seed schedule data
-- ============================================================

-- Таблица записей на приём
CREATE TABLE IF NOT EXISTS appointments (
  id           SERIAL PRIMARY KEY,
  doctor_id    INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
  service_id   INTEGER REFERENCES services(id) ON DELETE CASCADE,
  clinic_id    INTEGER NOT NULL REFERENCES clinics(id),
  start_time   TIMESTAMP NOT NULL,
  end_time     TIMESTAMP NOT NULL,
  patient_name VARCHAR(255),
  session_id   VARCHAR(255),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_doctor_or_service CHECK (doctor_id IS NOT NULL OR service_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_appt_doctor  ON appointments(doctor_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appt_service ON appointments(service_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appt_clinic  ON appointments(clinic_id, start_time);

-- ============================================================
-- Seed: расписание врачей — Пн–Пт 09:00–18:00
-- для всех врачей по всем их локациям
-- ============================================================
INSERT INTO doctor_schedule
  (doctor_id, clinic_id, day_of_week, start_time, end_time, valid_from, valid_to)
SELECT
  dl.doctor_id,
  dl.clinic_id,
  d.dow,
  '09:00'::time,
  '18:00'::time,
  '2026-01-01'::date,
  '2026-12-31'::date
FROM doctor_locations dl
CROSS JOIN (SELECT generate_series(1, 5) AS dow) d
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed: расписание услуг — Пн–Пт 09:00–18:00
-- для всех услуг по всем клиникам
-- ============================================================
INSERT INTO service_schedule
  (service_id, clinic_id, day_of_week, start_time, end_time, valid_from, valid_to)
SELECT
  sbc.service_id,
  sbc.clinic_id,
  d.dow,
  '09:00'::time,
  '18:00'::time,
  '2026-01-01'::date,
  '2026-12-31'::date
FROM services_by_clinics sbc
CROSS JOIN (SELECT generate_series(1, 5) AS dow) d
ON CONFLICT DO NOTHING;
