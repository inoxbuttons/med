-- Seed: первая клиника работает через MedFlex (без ключа = mock-сервер)
-- telegram_bot_token берётся из env TELEGRAM_BOT_TOKEN через ClinicNetConfigService
UPDATE clinic_nets SET mis = 'medflex' WHERE id = 1;
