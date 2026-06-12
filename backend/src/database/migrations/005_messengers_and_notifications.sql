-- ============================================================
-- Migration 005: messenger tokens in clinic_nets, contacts, notification logs
-- Depends on: 003_clinic_nets_mis.sql, 004_clinic_nets_medflex_key.sql
-- ============================================================

-- Токены мессенджеров добавляем прямо в clinic_nets (следуем паттерну qwen)
ALTER TABLE clinic_nets ADD COLUMN IF NOT EXISTS telegram_bot_token VARCHAR(255) NULL;
ALTER TABLE clinic_nets ADD COLUMN IF NOT EXISTS max_bot_token       VARCHAR(255) NULL;
ALTER TABLE clinic_nets ADD COLUMN IF NOT EXISTS max_bot_api_url     VARCHAR(255) NULL;

-- Привязка пациента к аккаунту в мессенджере (per-клиника)
CREATE TABLE IF NOT EXISTS messenger_contacts (
  id             SERIAL PRIMARY KEY,
  clinic_net_id  INTEGER NOT NULL REFERENCES clinic_nets(id) ON DELETE CASCADE,
  person_id      INTEGER REFERENCES persons(id) ON DELETE SET NULL,
  messenger      VARCHAR(32)  NOT NULL,   -- 'telegram' | 'max'
  chat_id        VARCHAR(128) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_net_id, messenger, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_mc_person            ON messenger_contacts(person_id);
CREATE INDEX IF NOT EXISTS idx_mc_clinic_messenger  ON messenger_contacts(clinic_net_id, messenger, chat_id);

-- Лог отправленных уведомлений о записях
CREATE TABLE IF NOT EXISTS notification_logs (
  id                  SERIAL PRIMARY KEY,
  clinic_net_id       INTEGER REFERENCES clinic_nets(id) ON DELETE SET NULL,
  external_appt_id    VARCHAR(128) NOT NULL,
  appointment_type    VARCHAR(16)  NOT NULL DEFAULT 'doctor',
  messenger           VARCHAR(32)  NOT NULL,
  chat_id             VARCHAR(128) NOT NULL,
  offset_minutes      INTEGER      NOT NULL,
  sent_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
  status              VARCHAR(16)  NOT NULL DEFAULT 'sent',
  error_message       TEXT,
  UNIQUE (external_appt_id, offset_minutes, messenger, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_nl_appt    ON notification_logs(external_appt_id);
CREATE INDEX IF NOT EXISTS idx_nl_sent_at ON notification_logs(sent_at);
