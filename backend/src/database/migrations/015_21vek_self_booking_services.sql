-- 015: МРТ, УЗИ и ДНК-тесты сети «XXI Век» — самостоятельная запись по слотам.
--   - self_booking = true для услуг направлений «Магнитно-резонансная томография»,
--     «Ультразвуковая диагностика», «Медикал Геномикс ДНК тесты» (кроме стационарных и «на приёме врача»);
--   - расписание услуги в каждой клинике сети, где она оказывается:
--     Пн–Пт 09:00–18:00, Сб 09:00–15:00, слот 30 мин (как у врачей сети).
-- КТ не меняется — остаётся по направлению (заявка оператору).
-- Идемпотентно: расписание добавляется только туда, где его ещё нет.

BEGIN;

CREATE TEMP TABLE _sb_services ON COMMIT DROP AS
SELECT DISTINCT s.id AS service_id, sbc.clinic_id
FROM services s
JOIN med_fields mf ON mf.id = s.med_field_id
JOIN services_by_clinics sbc ON sbc.service_id = s.id
JOIN clinics c ON c.id = sbc.clinic_id
JOIN clinic_nets n ON n.id = c.clinic_net_id
WHERE n.name = 'XXI Век'
  AND mf.name IN ('Магнитно-резонансная томография', 'Ультразвуковая диагностика', 'Медикал Геномикс ДНК тесты')
  AND NOT s.stationary
  AND NOT s.at_doctor_visit;

UPDATE services SET self_booking = true
WHERE id IN (SELECT service_id FROM _sb_services) AND NOT self_booking;

INSERT INTO service_working_hours (service_id, clinic_id, day_of_week, start_time, end_time, slot_duration, is_active)
SELECT sb.service_id, sb.clinic_id, d, TIME '09:00',
       CASE WHEN d = 6 THEN TIME '15:00' ELSE TIME '18:00' END, 30, true
FROM _sb_services sb
CROSS JOIN generate_series(1, 6) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM service_working_hours w
  WHERE w.service_id = sb.service_id AND w.clinic_id = sb.clinic_id
);

COMMIT;
