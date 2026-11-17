-- Migration 009: operator_requests table

CREATE TABLE IF NOT EXISTS operator_requests (
  id              SERIAL PRIMARY KEY,
  clinic_id       INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  service_id      INTEGER REFERENCES services(id) ON DELETE SET NULL,
  doctor_id       INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
  patient_id      INTEGER,
  patient_name    VARCHAR(255),
  patient_phone   VARCHAR(50),
  patient_birthday DATE,
  request_type    VARCHAR(50) NOT NULL DEFAULT 'service_booking',
  notes           TEXT,
  session_id      VARCHAR(255),
  status          VARCHAR(50) NOT NULL DEFAULT 'new',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operator_requests_clinic_id ON operator_requests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_operator_requests_status    ON operator_requests(status);
CREATE INDEX IF NOT EXISTS idx_operator_requests_created_at ON operator_requests(created_at);
