-- 016: учёт токенов по задачам модели и версиям промпта (рефакторинг, этап 2).
--   task        — legacy | nlu | answer | symptoms | agent | embed
--   prompt_hash — PromptBuilder.hash: какой версией промпта оплачен вызов
-- Идемпотентно.

ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS task VARCHAR(20);
ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS prompt_hash VARCHAR(12);
UPDATE token_usage SET task = 'legacy' WHERE task IS NULL;
CREATE INDEX IF NOT EXISTS idx_token_usage_task_created ON token_usage (task, created_at);
