-- ============================================================
-- med database — initial schema
-- ============================================================

-- Сети клиник
CREATE TABLE IF NOT EXISTS clinic_nets (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  website     VARCHAR(255),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Клиники
CREATE TABLE IF NOT EXISTS clinics (
  id            SERIAL PRIMARY KEY,
  clinic_net_id INTEGER REFERENCES clinic_nets(id) ON DELETE SET NULL,
  name          VARCHAR(255) NOT NULL,
  address       VARCHAR(500),
  phone         VARCHAR(50),
  email         VARCHAR(255),
  latitude      NUMERIC(10, 7),
  longitude     NUMERIC(10, 7),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Медицинские направления (Кардиология, Урология и т.д.)
CREATE TABLE IF NOT EXISTS med_fields (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Специализации врачей
CREATE TABLE IF NOT EXISTS specialities (
  id           SERIAL PRIMARY KEY,
  med_field_id INTEGER REFERENCES med_fields(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Врачи
CREATE TABLE IF NOT EXISTS doctors (
  id           SERIAL PRIMARY KEY,
  clinic_id    INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  speciality_id INTEGER REFERENCES specialities(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  photo_url    VARCHAR(500),
  profile_url  VARCHAR(500),
  price        NUMERIC(10, 2),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Места приёма врача (врач может принимать в нескольких клиниках)
CREATE TABLE IF NOT EXISTS doctor_locations (
  id         SERIAL PRIMARY KEY,
  doctor_id  INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id  INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  UNIQUE (doctor_id, clinic_id)
);

-- Услуги
CREATE TABLE IF NOT EXISTS services (
  id           SERIAL PRIMARY KEY,
  clinic_id    INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  med_field_id INTEGER REFERENCES med_fields(id) ON DELETE SET NULL,
  name         VARCHAR(500) NOT NULL,
  direction    VARCHAR(255),
  price        NUMERIC(10, 2),
  price_raw    VARCHAR(50),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Расписание врачей
CREATE TABLE IF NOT EXISTS doctor_schedule (
  id          SERIAL PRIMARY KEY,
  doctor_id   INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id   INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  day_of_week SMALLINT CHECK (day_of_week BETWEEN 1 AND 7),  -- 1=Пн, 7=Вс
  start_time  TIME,
  end_time    TIME,
  valid_from  DATE,
  valid_to    DATE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Расписание услуг / оборудования
CREATE TABLE IF NOT EXISTS service_schedule (
  id          SERIAL PRIMARY KEY,
  service_id  INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  clinic_id   INTEGER REFERENCES clinics(id) ON DELETE SET NULL,
  day_of_week SMALLINT CHECK (day_of_week BETWEEN 1 AND 7),
  start_time  TIME,
  end_time    TIME,
  valid_from  DATE,
  valid_to    DATE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Индексы
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clinics_net       ON clinics(clinic_net_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic    ON doctors(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_spec      ON doctors(speciality_id);
CREATE INDEX IF NOT EXISTS idx_services_clinic   ON services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_services_field    ON services(med_field_id);
CREATE INDEX IF NOT EXISTS idx_doc_sched_doctor  ON doctor_schedule(doctor_id);
CREATE INDEX IF NOT EXISTS idx_svc_sched_service ON service_schedule(service_id);
CREATE INDEX IF NOT EXISTS idx_spec_field        ON specialities(med_field_id);
