"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CatalogSearch_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogSearch = void 0;
exports.relevantHits = relevantHits;
exports.decide = decide;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const clinic_profile_service_1 = require("../profile/clinic-profile.service");
const catalog_indexer_service_1 = require("./catalog-indexer.service");
const text_1 = require("./text");
const PER_SIGNAL = 30;
const VEC_MIN = 0.6;
const RRF_K = 60;
const TRGM_MIN = 0.3;
function relevantHits(hits) {
    const best = Math.max(0, ...hits.map((h) => h.coverage));
    if (best >= 0.66)
        return hits.filter((h) => h.coverage === best);
    const bestVec = Math.max(0, ...hits.map((h) => h.vecSim ?? 0));
    const vecFloor = Math.max(VEC_MIN, bestVec - 0.05);
    return hits.filter((h) => h.trgm >= 0.6 || (h.vecSim !== null && h.vecSim >= vecFloor));
}
function decide(query, hits, maxChoice = 8) {
    if (hits.length === 0)
        return { kind: 'none', hits: [] };
    const [top, second] = hits;
    const q = (0, text_1.normalize)(query);
    const exact = hits.find((h) => (0, text_1.normalize)(h.title) === q);
    if (exact)
        return { kind: 'single', hit: exact, hits };
    if (!second)
        return { kind: 'single', hit: top, hits };
    const byTrgm = [...hits].sort((a, b) => b.trgm - a.trgm);
    if (byTrgm[0].trgm >= 0.75 && byTrgm[0].trgm - byTrgm[1].trgm >= 0.2)
        return { kind: 'single', hit: byTrgm[0], hits };
    const signals = (h) => Object.values(h.ranks).filter((r) => r !== null).length;
    if (top.score >= second.score * 1.35 && signals(top) >= 2)
        return { kind: 'single', hit: top, hits };
    return { kind: 'choice', hits: hits.slice(0, maxChoice) };
}
let CatalogSearch = CatalogSearch_1 = class CatalogSearch {
    constructor(db, profiles, embeddings) {
        this.db = db;
        this.profiles = profiles;
        this.embeddings = embeddings;
        this.logger = new common_1.Logger(CatalogSearch_1.name);
    }
    async hasIndex(clinicNetId, kind) {
        const rows = await this.db.query(`SELECT 1 FROM catalog_index WHERE clinic_net_id = $1 AND ($2::text IS NULL OR kind = $2) LIMIT 1`, [clinicNetId, kind ?? null]);
        return rows.length > 0;
    }
    async search(clinicNetId, query, opts) {
        const q = (0, text_1.normalize)(query);
        if (!q)
            return [];
        const synonyms = this.profiles.forNet(clinicNetId).synonyms;
        const groups = (0, text_1.toTsGroups)(query, synonyms);
        const tsq = groups.join(' | ');
        let vector = null;
        if (!opts.noVector && this.embeddings.enabled) {
            try {
                const [v] = await this.embeddings.embed([query], 'query');
                vector = (0, catalog_indexer_service_1.toVectorLiteral)(v);
            }
            catch (err) {
                this.logger.warn(`Эмбеддинг запроса не получен, поиск без векторов: ${String(err)}`);
            }
        }
        const rows = await this.db.query(`WITH base AS (
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
        LIMIT $7`, [clinicNetId, opts.kinds, opts.clinicId ?? null, tsq, q, vector, opts.limit ?? 10, groups]);
        const num = (v) => (v === null ? null : Number(v));
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
    async searchAndDecide(clinicNetId, query, opts) {
        return decide(query, await this.search(clinicNetId, query, opts));
    }
};
exports.CatalogSearch = CatalogSearch;
exports.CatalogSearch = CatalogSearch = CatalogSearch_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __param(2, (0, common_1.Inject)(catalog_indexer_service_1.EMBEDDING_PORT)),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        clinic_profile_service_1.ClinicProfileService, Object])
], CatalogSearch);
//# sourceMappingURL=catalog-search.service.js.map