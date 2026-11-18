-- 014: услуга «Процедурный кабинет» сети «XXI Век».
-- На сайте это карточка в списке врачей (кнопка «Записаться», клиники «На русском поле» и «На северном»),
-- но в прайсах отдельной услуги нет. Заводим услугу по направлению врача (self_booking = false):
-- запись идёт через заявку оператору, расписание не нужно. Цена не указана на сайте.
-- Идемпотентно.

BEGIN;

INSERT INTO services (name, med_field_id, stationary, self_booking, at_doctor_visit, price_from)
SELECT 'Процедурный кабинет', mf.id, false, false, false, false
FROM med_fields mf
WHERE mf.name = 'Терапия'
  AND NOT EXISTS (
    SELECT 1 FROM services s
    JOIN services_by_clinics sbc ON sbc.service_id = s.id
    JOIN clinics c ON c.id = sbc.clinic_id
    JOIN clinic_nets n ON n.id = c.clinic_net_id
    WHERE s.name = 'Процедурный кабинет' AND n.name = 'XXI Век'
  );

INSERT INTO services_by_clinics (service_id, clinic_id, price)
SELECT s.id, c.id, NULL
FROM services s
CROSS JOIN clinics c
WHERE s.name = 'Процедурный кабинет'
  AND c.name IN ('21 Век на Русском поле', '21 Век на Северном')
  AND NOT EXISTS (SELECT 1 FROM services_by_clinics x WHERE x.service_id = s.id)
  AND s.id = (SELECT MAX(id) FROM services WHERE name = 'Процедурный кабинет');

COMMIT;
