"""
Импорт данных из doctors.json и services.json в PostgreSQL.
Таблицы: med_fields, specialities, doctors, doctor_locations, services, services_by_clinics
"""

import json
import re
import psycopg2
from psycopg2.extras import execute_values

# ── Подключение ──────────────────────────────────────────────────────────────
conn = psycopg2.connect(
    host="localhost", port=5432,
    dbname="med", user="root", password="root"
)
cur = conn.cursor()

# ── Загрузка файлов ──────────────────────────────────────────────────────────
with open("results/doctors.json", encoding="utf-8") as f:
    doctors_raw = json.load(f)

with open("results/services.json", encoding="utf-8") as f:
    services_raw = json.load(f)

# ── Вспомогательные функции ──────────────────────────────────────────────────
def parse_price(value: str | None) -> float | None:
    if not value:
        return None
    cleaned = re.sub(r"[^\d,.]", "", value).replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None

# Маппинг локаций на clinic_id
LOCATION_MAP = {
    "северном":     1,  # 21 Век на Северном
    "русском поле": 2,  # 21 Век на Русском поле
}

def location_to_clinic_id(location: str) -> int | None:
    loc = location.lower()
    for key, cid in LOCATION_MAP.items():
        if key in loc:
            return cid
    return None

def upsert_returning_id(table: str, unique_col: str, value: str) -> int:
    cur.execute(
        f"INSERT INTO {table} ({unique_col}) VALUES (%s) "
        f"ON CONFLICT ({unique_col}) DO UPDATE SET {unique_col} = EXCLUDED.{unique_col} "
        f"RETURNING id",
        (value,)
    )
    return cur.fetchone()[0]

# ════════════════════════════════════════════════════════════════════════════
# 1. med_fields  —  из направлений services.json
# ════════════════════════════════════════════════════════════════════════════
print("1. Inserting med_fields...")

directions = sorted({s["direction"] for s in services_raw if s.get("direction")})
cur.execute("ALTER TABLE med_fields DROP CONSTRAINT IF EXISTS med_fields_name_key")
cur.execute("ALTER TABLE med_fields ADD CONSTRAINT med_fields_name_key UNIQUE (name)")
conn.commit()

field_id: dict[str, int] = {}
for direction in directions:
    fid = upsert_returning_id("med_fields", "name", direction)
    field_id[direction] = fid

conn.commit()
print(f"   {len(field_id)} med_fields")

# ════════════════════════════════════════════════════════════════════════════
# 2. specialities  —  уникальные специализации врачей
#    Пытаемся привязать к med_field по совпадению подстроки
# ════════════════════════════════════════════════════════════════════════════
print("2. Inserting specialities...")

def guess_field_id(spec: str) -> int | None:
    """Ищем med_field, название которого входит в специализацию или наоборот."""
    spec_lower = spec.lower()
    for fname, fid in field_id.items():
        f_lower = fname.lower()
        # убираем окончания: гинекологИЯ → гинеколог, урологИЯ → уролог
        root = f_lower.rstrip("ияь")
        if root and root in spec_lower:
            return fid
    return None

unique_specs = sorted({d["specialization"] for d in doctors_raw if d.get("specialization")})
spec_id: dict[str, int] = {}

for spec in unique_specs:
    mf_id = guess_field_id(spec)
    cur.execute(
        "INSERT INTO specialities (name, med_field_id) VALUES (%s, %s) "
        "ON CONFLICT DO NOTHING RETURNING id",
        (spec, mf_id)
    )
    row = cur.fetchone()
    if row is None:
        cur.execute("SELECT id FROM specialities WHERE name = %s", (spec,))
        row = cur.fetchone()
    spec_id[spec] = row[0]

conn.commit()
print(f"   {len(spec_id)} specialities")

# ════════════════════════════════════════════════════════════════════════════
# 3. doctors
# ════════════════════════════════════════════════════════════════════════════
print("3. Inserting doctors...")

doctor_id: dict[str, int] = {}

for d in doctors_raw:
    name       = d["name"]
    spec       = d.get("specialization") or ""
    profile    = d.get("profileUrl") or ""
    sid        = spec_id.get(spec)

    cur.execute(
        "INSERT INTO doctors (name, speciality_id, profile_url) "
        "VALUES (%s, %s, %s) RETURNING id",
        (name, sid, profile)
    )
    doctor_id[name] = cur.fetchone()[0]

conn.commit()
print(f"   {len(doctor_id)} doctors")

# ════════════════════════════════════════════════════════════════════════════
# 4. doctor_locations  —  привязка врача к клиникам + цена
# ════════════════════════════════════════════════════════════════════════════
print("4. Inserting doctor_locations...")

inserted_loc = 0
for d in doctors_raw:
    did   = doctor_id[d["name"]]
    price = parse_price(d.get("price"))

    for loc in d.get("locations", []):
        cid = location_to_clinic_id(loc)
        if cid is None:
            continue
        cur.execute(
            "INSERT INTO doctor_locations (doctor_id, clinic_id, price) "
            "VALUES (%s, %s, %s) ON CONFLICT (doctor_id, clinic_id) DO NOTHING",
            (did, cid, price)
        )
        inserted_loc += 1

conn.commit()
print(f"   {inserted_loc} doctor_locations")

# ════════════════════════════════════════════════════════════════════════════
# 5. services  —  name + med_field_id
# ════════════════════════════════════════════════════════════════════════════
print("5. Inserting services...")

service_id: dict[tuple, int] = {}  # (direction, name) → id

for s in services_raw:
    direction = s.get("direction") or ""
    name      = s["service"]
    mf_id     = field_id.get(direction)
    key       = (direction, name)

    if key in service_id:
        continue

    cur.execute(
        "INSERT INTO services (name, med_field_id) VALUES (%s, %s) RETURNING id",
        (name, mf_id)
    )
    service_id[key] = cur.fetchone()[0]

conn.commit()
print(f"   {len(service_id)} services")

# ════════════════════════════════════════════════════════════════════════════
# 6. services_by_clinics  —  услуга доступна в обеих клиниках с одинаковой ценой
#    (в данных нет разбивки по клиникам, поэтому добавляем для обеих)
# ════════════════════════════════════════════════════════════════════════════
print("6. Inserting services_by_clinics...")

rows = []
seen = set()
for s in services_raw:
    key   = (s.get("direction") or "", s["service"])
    sid   = service_id.get(key)
    if sid is None:
        continue
    price = parse_price(s.get("price"))

    for clinic_id in (1, 2):
        pk = (sid, clinic_id)
        if pk in seen:
            continue
        seen.add(pk)
        rows.append((sid, clinic_id, price))

execute_values(
    cur,
    "INSERT INTO services_by_clinics (service_id, clinic_id, price) VALUES %s "
    "ON CONFLICT DO NOTHING",
    rows
)
conn.commit()
print(f"   {len(rows)} services_by_clinics rows")

# ════════════════════════════════════════════════════════════════════════════
# Итог
# ════════════════════════════════════════════════════════════════════════════
for table in ("med_fields", "specialities", "doctors", "doctor_locations",
              "services", "services_by_clinics"):
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    print(f"   {table}: {cur.fetchone()[0]} rows")

cur.close()
conn.close()
print("\nDone.")
