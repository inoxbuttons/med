-- 012: услуги «на приёме врача» сети «XXI Век» привязываются к клиникам, где работают врачи направления.
-- Прайсы PDF давали клинику по месту прайса, а не по месту приёма врача: например, консультации
-- флеболога стояли в «Русском поле», а флеболог принимает только на «Северном» — записаться было нельзя.
-- Для услуг at_doctor_visit = true, у направления (med_field) которых есть врачи в сети:
--   - добавляются клиники, где работают врачи направления (цена — как у существующей привязки);
--   - удаляются клиники, где врачей направления нет.
-- Остальные услуги (УЗИ, КТ, анализы и т. п.) не меняются. Идемпотентно.

BEGIN;

CREATE TEMP TABLE _net_clinics ON COMMIT DROP AS
SELECT c.id FROM clinics c
JOIN clinic_nets n ON n.id = c.clinic_net_id
WHERE n.name = 'XXI Век';

CREATE TEMP TABLE _field_clinics ON COMMIT DROP AS
SELECT DISTINCT sp.med_field_id, dl.clinic_id
FROM doctors d
JOIN specialities sp ON sp.id = d.speciality_id
JOIN doctor_locations dl ON dl.doctor_id = d.id
WHERE dl.clinic_id IN (SELECT id FROM _net_clinics);

CREATE TEMP TABLE _svc ON COMMIT DROP AS
SELECT s.id, s.med_field_id, MAX(sbc.price) AS price
FROM services s
JOIN services_by_clinics sbc ON sbc.service_id = s.id
WHERE sbc.clinic_id IN (SELECT id FROM _net_clinics)
  AND s.at_doctor_visit
  AND s.med_field_id IN (SELECT med_field_id FROM _field_clinics)
GROUP BY s.id, s.med_field_id;

INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT v.id, fc.clinic_id, v.price
FROM _svc v
JOIN _field_clinics fc ON fc.med_field_id = v.med_field_id
ON CONFLICT (service_id, clinic_id) DO NOTHING;

DELETE FROM services_by_clinics sbc
USING _svc v
WHERE sbc.service_id = v.id
  AND sbc.clinic_id IN (SELECT id FROM _net_clinics)
  AND NOT EXISTS (
    SELECT 1 FROM _field_clinics fc
    WHERE fc.med_field_id = v.med_field_id AND fc.clinic_id = sbc.clinic_id
  );

COMMIT;
