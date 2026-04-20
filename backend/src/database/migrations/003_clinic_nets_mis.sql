-- Добавляет колонку mis в clinic_nets для хранения идентификатора МИС.
-- Значение 'infoclinica' указывает на интеграцию с МИС Инфоклиника.

ALTER TABLE clinic_nets ADD COLUMN IF NOT EXISTS mis VARCHAR(50) NULL;

-- Устанавливаем значение для существующей записи сети клиник
UPDATE clinic_nets SET mis = 'infoclinica' WHERE id = 1;
