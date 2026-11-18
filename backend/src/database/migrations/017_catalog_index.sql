-- 017: поисковый индекс каталога сети для гибридного поиска (рефакторинг, этап 3).
-- Одна строка = услуга / специальность / врач сети. Поиск: полнотекстовый (russian),
-- триграммы (опечатки, фамилии в падежах) и векторный (смысл, жаргон); слияние RRF.
-- Наполняется CatalogIndexer из CatalogSourcePort + синонимов профиля сети.
-- embedding заполняется, только если включены эмбеддинги (EMBEDDINGS_ENABLED=true).
-- Размерность 1024 — BAAI/bge-m3 (cloud.ru). Другая модель с иной размерностью
-- потребует новой миграции. Идемпотентно.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS catalog_index (
  id              BIGSERIAL PRIMARY KEY,
  clinic_net_id   INTEGER NOT NULL REFERENCES clinic_nets(id) ON DELETE CASCADE,
  kind            VARCHAR(16) NOT NULL CHECK (kind IN ('service', 'speciality', 'doctor')),
  entity_id       VARCHAR(255) NOT NULL,
  title           TEXT NOT NULL,
  search_text     TEXT NOT NULL,
  -- название весит больше (A), чем направление, специальность и синонимы (B)
  tsv             TSVECTOR GENERATED ALWAYS AS (
                    setweight(to_tsvector('russian', title), 'A') ||
                    setweight(to_tsvector('russian', search_text), 'B')
                  ) STORED,
  embedding       VECTOR(1024),
  embedding_model VARCHAR(100),
  -- sha1(search_text): эмбеддинг пересчитывается только при изменении текста
  content_hash    VARCHAR(40) NOT NULL,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_net_id, kind, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_index_tsv ON catalog_index USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_catalog_index_title_trgm ON catalog_index USING GIN (lower(title) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_catalog_index_net_kind ON catalog_index (clinic_net_id, kind);
CREATE INDEX IF NOT EXISTS idx_catalog_index_embedding ON catalog_index USING hnsw (embedding vector_cosine_ops);
