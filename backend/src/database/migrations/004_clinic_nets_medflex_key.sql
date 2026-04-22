-- Добавляет колонку medflex_key в clinic_nets для хранения API-ключа MedFlex.
-- Ключ используется при misType='medflex' для авторизации запросов к API MedFlex.

ALTER TABLE clinic_nets ADD COLUMN IF NOT EXISTS medflex_key VARCHAR(255) NULL;

-- Mock API-ключ для тестирования (заменить на реальный при подключении к MedFlex)
UPDATE clinic_nets SET medflex_key = 'mock-medflex-api-key-v1' WHERE id = 1;
