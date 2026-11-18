import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmbeddingPort } from '../ports/embedding.port';
import { ClinicProfileService } from '../profile/clinic-profile.service';
import { CatalogKind, EMBEDDING_PORT, toVectorLiteral } from './catalog-indexer.service';
import { normalize, toTsGroups } from './text';

/** Сколько кандидатов берёт каждый способ поиска до слияния. */
const PER_SIGNAL = 30;
/** Порог косинусного сходства для результатов «только по смыслу» (bge-m3: мусор ≈ 0,45–0,52, близкое ≥ 0,6). */
const VEC_MIN = 0.6;
/** Константа Reciprocal Rank Fusion. */
const RRF_K = 60;
/** Порог триграммного сходства (0..1). */
const TRGM_MIN = 0.3;

export interface SearchHit {
  kind: CatalogKind;
  entityId: string;
  title: string;
  score: number;
  /** Место в выдаче каждого способа (null — не нашёл). */
  ranks: { fts: number | null; trgm: number | null; vector: number | null };
  trgm: number;
  /** Доля слов запроса, найденных полнотекстовым поиском (0..1). */
  coverage: number;
  /** Косинусное сходство с запросом (0..1); null — векторы не использовались. */
  vecSim: number | null;
  /** Название начинается с запроса («МРТ головного мозга» → «МРТ ГОЛОВНОГО МОЗГА (…)»). */
  prefix: boolean;
  meta: Record<string, any>;
}

export interface SearchOptions {
  kinds: CatalogKind[];
  clinicId?: number;
  limit?: number;
  /** Не вызывать эмбеддинги для запроса (например, в офлайн-проверках). */
  noVector?: boolean;
}

/**
 * Итог поиска для движка диалога:
 *   single — явный лидер, можно идти дальше без вопроса;
 *   choice — несколько близких вариантов, показать список;
 *   none   — ничего не найдено.
 */
export type SearchDecision =
  | { kind: 'single'; hit: SearchHit; hits: SearchHit[] }
  | { kind: 'choice'; hits: SearchHit[] }
  | { kind: 'none'; hits: [] };

/**
 * Релевантные результаты: лучшее покрытие слов запроса, если совпало ≥ ⅔ слов; иначе — близкие по
 * написанию (опечатки, части слова) или по смыслу (не ниже VEC_MIN и рядом с лучшим).
 * Одно случайно совпавшее слово («лазерная эпиляция» → «лазерная коагуляция») не проходит.
 */
export function relevantHits(hits: SearchHit[]): SearchHit[] {
  const best = Math.max(0, ...hits.map((h) => h.coverage));
  if (best >= 0.66) return hits.filter((h) => h.coverage === best);
  const bestVec = Math.max(0, ...hits.map((h) => h.vecSim ?? 0));
  const vecFloor = Math.max(VEC_MIN, bestVec - 0.05);
  return hits.filter((h) => h.trgm >= 0.6 || (h.vecSim !== null && h.vecSim >= vecFloor));
}

/** Решение по выдаче. Вынесено отдельно — настраивается по золотому набору. */
export function decide(query: string, hits: SearchHit[], maxChoice = 8): SearchDecision {
  if (hits.length === 0) return { kind: 'none', hits: [] };
  const [top, second] = hits;
  const q = normalize(query);
  const exact = hits.find((h) => normalize(h.title) === q);
  if (exact) return { kind: 'single', hit: exact, hits };
  if (!second) return { kind: 'single', hit: top, hits };
  // Явный лидер по написанию: «колоноскопия» → «Видеоколоноскопия» (0,85), а не «Кольпоскопия» (0,53).
  const byTrgm = [...hits].sort((a, b) => b.trgm - a.trgm);
  if (byTrgm[0].trgm >= 0.75 && byTrgm[0].trgm - byTrgm[1].trgm >= 0.2) return { kind: 'single', hit: byTrgm[0], hits };
  const signals = (h: SearchHit) => Object.values(h.ranks).filter((r) => r !== null).length;
  // Лидер: заметный отрыв по сумме RRF и совпадение хотя бы двумя способами.
  if (top.score >= second.score * 1.35 && signals(top) >= 2) return { kind: 'single', hit: top, hits };
  return { kind: 'choice', hits: hits.slice(0, maxChoice) };
}

@Injectable()
export class CatalogSearch {
  private readonly logger = new Logger(CatalogSearch.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly profiles: ClinicProfileService,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
  ) {}

  /** Есть ли индекс у сети (иначе — использовать поиск МИС). */
  async hasIndex(clinicNetId: number, kind?: CatalogKind): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT 1 FROM catalog_index WHERE clinic_net_id = $1 AND ($2::text IS NULL OR kind = $2) LIMIT 1`,
      [clinicNetId, kind ?? null],
    );
    return rows.length > 0;
  }

  async search(clinicNetId: number, query: string, opts: SearchOptions): Promise<SearchHit[]> {
    const q = normalize(query);
    if (!q) return [];
    const synonyms = this.profiles.forNet(clinicNetId).synonyms;
    const groups = toTsGroups(query, synonyms);
    const tsq = groups.join(' | ');

    let vector: string | null = null;
    if (!opts.noVector && this.embeddings.enabled) {
      try {
        const [v] = await this.embeddings.embed([query], 'query');
        vector = toVectorLiteral(v);
      } catch (err) {
        this.logger.warn(`Эмбеддинг запроса не получен, поиск без векторов: ${String(err)}`);
      }
    }

    const rows: Array<{
      kind: CatalogKind; entity_id: string; title: string; meta: Record<string, any>;
      score: string; fts_rank: string | null; trg_rank: string | null; vec_rank: string | null; trg: string | null; matched: string; total_groups: string; vec_sim: string | null; prefix: boolean;
    }> = await this.db.query(
      `WITH base AS (
         SELECT id, kind, entity_id, title, meta, tsv, embedding,
                GREATEST(word_similarity($5, lower(title)), similarity($5, lower(title))) AS trg,
                (SELECT count(*) FROM unnest($8::text[]) g WHERE tsv @@ to_tsquery('russian', g)) AS matched,
                lower(title) LIKE $5 || '%' AS pre
           FROM catalog_index
          WHERE clinic_net_id = $1 AND kind = ANY($2)
            AND ($3::int IS NULL OR meta->'clinicIds' @> to_jsonb($3::int))
       ),
       fts AS (
         SELECT id, row_number() OVER (ORDER BY matched DESC, pre DESC, ts_rank(tsv, q, 1) DESC, trg DESC) AS r
           FROM base, to_tsquery('russian', $4) q
          WHERE $4 <> '' AND tsv @@ q
          ORDER BY r LIMIT ${PER_SIGNAL}
       ),
       trg AS (
         SELECT id, row_number() OVER (ORDER BY trg DESC) AS r
           FROM base WHERE trg >= ${TRGM_MIN}
          ORDER BY r LIMIT ${PER_SIGNAL}
       ),
       vec AS (
         SELECT id, row_number() OVER (ORDER BY embedding <=> $6::vector) AS r
           FROM base WHERE $6::text IS NOT NULL AND embedding IS NOT NULL
          ORDER BY r LIMIT ${PER_SIGNAL}
       )
       SELECT b.kind, b.entity_id, b.title, b.meta, b.trg, b.matched,
              (SELECT count(*) FROM unnest($8::text[]) g WHERE numnode(to_tsquery('russian', g)) > 0) AS total_groups,
              CASE WHEN $6::text IS NOT NULL AND b.embedding IS NOT NULL THEN 1 - (b.embedding <=> $6::vector) END AS vec_sim,
              b.pre AS prefix,
              COALESCE(1.0 / (${RRF_K} + f.r), 0) + COALESCE(1.0 / (${RRF_K} + t.r), 0) + COALESCE(1.0 / (${RRF_K} + v.r), 0) AS score,
              f.r AS fts_rank, t.r AS trg_rank, v.r AS vec_rank
         FROM base b
         LEFT JOIN fts f ON f.id = b.id
         LEFT JOIN trg t ON t.id = b.id
         LEFT JOIN vec v ON v.id = b.id
        WHERE f.id IS NOT NULL OR t.id IS NOT NULL OR v.id IS NOT NULL
        ORDER BY b.matched DESC, b.pre DESC, score DESC, b.trg DESC
        LIMIT $7`,
      [clinicNetId, opts.kinds, opts.clinicId ?? null, tsq, q, vector, opts.limit ?? 10, groups],
    );

    const num = (v: string | null) => (v === null ? null : Number(v));
    return rows.map((r) => ({
      kind: r.kind,
      entityId: r.entity_id,
      title: r.title,
      score: Number(r.score),
      ranks: { fts: num(r.fts_rank), trgm: num(r.trg_rank), vector: num(r.vec_rank) },
      trgm: Number(r.trg ?? 0),
      coverage: Number(r.total_groups) ? Number(r.matched) / Number(r.total_groups) : 0,
      vecSim: r.vec_sim === null ? null : Number(r.vec_sim),
      prefix: !!r.prefix,
      meta: r.meta,
    }));
  }

  async searchAndDecide(clinicNetId: number, query: string, opts: SearchOptions): Promise<SearchDecision> {
    return decide(query, await this.search(clinicNetId, query, opts));
  }
}
