-- 016: учёт токенов по задачам модели и версиям промпта (рефакторинг, этап 2).
--   task        — legacy | nlu | answer | symptoms | agent | embed
--   prompt_hash — PromptBuilder.hash: какой версией промпта оплачен вызов
-- Идемпотентно. Базовая таблица раньше создавалась вне миграций — здесь на случай чистой базы.

CREATE TABLE IF NOT EXISTS token_usage (
  id                SERIAL PRIMARY KEY,
  clinic_net_id     INTEGER REFERENCES clinic_nets(id) ON DELETE SET NULL,
  session_id        VARCHAR(255) NOT NULL,
  provider          VARCHAR(50)  NOT NULL,
  prompt_tokens     INTEGER      NOT NULL,
  completion_tokens INTEGER      NOT NULL,
  total_tokens      INTEGER      NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_token_usage_clinic_net_created ON token_usage (clinic_net_id, created_at);

ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS task VARCHAR(20);
ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS prompt_hash VARCHAR(12);
UPDATE token_usage SET task = 'legacy' WHERE task IS NULL;
CREATE INDEX IF NOT EXISTS idx_token_usage_task_created ON token_usage (task, created_at);
