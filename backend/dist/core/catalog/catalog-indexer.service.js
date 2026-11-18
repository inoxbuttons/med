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
var CatalogIndexer_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogIndexer = exports.EMBEDDING_PORT = void 0;
exports.buildIndexDocs = buildIndexDocs;
exports.contentHash = contentHash;
exports.toVectorLiteral = toVectorLiteral;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const clinic_profile_service_1 = require("../profile/clinic-profile.service");
const text_1 = require("./text");
exports.EMBEDDING_PORT = Symbol('EMBEDDING_PORT');
function buildIndexDocs(services, doctors, synonyms) {
    const docs = [];
    for (const s of services) {
        const clinicIds = s.clinics.map((c) => c.id);
        docs.push({
            kind: 'service',
            entityId: String(s.id),
            title: s.name,
            searchText: (0, text_1.expandForIndex)([s.name, s.direction].filter(Boolean).join(' · '), synonyms),
            meta: {
                direction: s.direction,
                selfBooking: s.selfBooking,
                atDoctorVisit: s.atDoctorVisit,
                stationary: s.stationary,
                priceFrom: s.priceFrom,
                clinics: s.clinics,
                clinicIds,
            },
        });
    }
    const specs = new Map();
    for (const d of doctors) {
        const clinicIds = d.clinics.map((c) => c.id);
        docs.push({
            kind: 'doctor',
            entityId: String(d.id),
            title: d.name,
            searchText: (0, text_1.expandForIndex)(`${d.name} · ${d.speciality}`, synonyms),
            meta: { speciality: d.speciality, specialityId: d.specialityId, price: d.price, clinics: d.clinics, clinicIds },
        });
        if (!d.speciality)
            continue;
        const key = (0, text_1.normalize)(d.speciality);
        const spec = specs.get(key) ?? { title: d.speciality.trim(), doctorIds: [], clinicIds: new Set() };
        spec.doctorIds.push(d.id);
        clinicIds.forEach((id) => spec.clinicIds.add(id));
        specs.set(key, spec);
    }
    for (const [key, spec] of specs) {
        docs.push({
            kind: 'speciality',
            entityId: key.slice(0, 255),
            title: spec.title,
            searchText: (0, text_1.expandForIndex)(spec.title, synonyms),
            meta: { doctorIds: spec.doctorIds, clinicIds: [...spec.clinicIds] },
        });
    }
    return docs;
}
function contentHash(doc) {
    return crypto.createHash('sha1').update(`${doc.title}\n${doc.searchText}`).digest('hex');
}
let CatalogIndexer = CatalogIndexer_1 = class CatalogIndexer {
    constructor(db, profiles, embeddings) {
        this.db = db;
        this.profiles = profiles;
        this.embeddings = embeddings;
        this.logger = new common_1.Logger(CatalogIndexer_1.name);
    }
    async reindex(catalog, opts = {}) {
        const netId = catalog.clinicNetId;
        const profile = this.profiles.forNet(netId);
        const [services, doctors] = await Promise.all([catalog.services(), catalog.doctors()]);
        const docs = buildIndexDocs(services, doctors, profile.synonyms);
        const existing = await this.db.query(`SELECT kind, entity_id, content_hash, embedding IS NOT NULL AS has_vec, embedding_model
           FROM catalog_index WHERE clinic_net_id = $1`, [netId]);
        const prev = new Map(existing.map((r) => [`${r.kind}:${r.entity_id}`, r]));
        let upserted = 0;
        const toEmbed = [];
        for (const doc of docs) {
            const hash = contentHash(doc);
            const old = prev.get(`${doc.kind}:${doc.entityId}`);
            const textChanged = !old || old.content_hash !== hash;
            await this.db.query(`INSERT INTO catalog_index (clinic_net_id, kind, entity_id, title, search_text, content_hash, meta, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (clinic_net_id, kind, entity_id) DO UPDATE SET
           title = EXCLUDED.title, search_text = EXCLUDED.search_text, meta = EXCLUDED.meta, updated_at = now(),
           content_hash = EXCLUDED.content_hash,
           embedding = CASE WHEN catalog_index.content_hash = EXCLUDED.content_hash THEN catalog_index.embedding END,
           embedding_model = CASE WHEN catalog_index.content_hash = EXCLUDED.content_hash THEN catalog_index.embedding_model END`, [netId, doc.kind, doc.entityId, doc.title, doc.searchText, hash, JSON.stringify(doc.meta)]);
            upserted++;
            const staleModel = old?.embedding_model && old.embedding_model !== this.embeddings.model;
            if (textChanged || !old?.has_vec || staleModel)
                toEmbed.push({ doc, hash });
        }
        const keep = new Set(docs.map((d) => `${d.kind}:${d.entityId}`));
        const gone = existing.filter((r) => !keep.has(`${r.kind}:${r.entity_id}`));
        for (const r of gone) {
            await this.db.query(`DELETE FROM catalog_index WHERE clinic_net_id = $1 AND kind = $2 AND entity_id = $3`, [netId, r.kind, r.entity_id]);
        }
        let embedded = 0;
        if (opts.embed && this.embeddings.enabled && toEmbed.length > 0) {
            const vectors = await this.embeddings.embed(toEmbed.map((x) => x.doc.searchText), 'document');
            for (let i = 0; i < toEmbed.length; i++) {
                const { doc, hash } = toEmbed[i];
                await this.db.query(`UPDATE catalog_index SET embedding = $1::vector, embedding_model = $2
            WHERE clinic_net_id = $3 AND kind = $4 AND entity_id = $5 AND content_hash = $6`, [toVectorLiteral(vectors[i]), this.embeddings.model, netId, doc.kind, doc.entityId, hash]);
                embedded++;
            }
        }
        const stats = { clinicNetId: netId, total: docs.length, upserted, deleted: gone.length, embedded };
        this.logger.log(`catalog_index сеть ${netId}: ${JSON.stringify(stats)}; без эмбеддинга: ${toEmbed.length - embedded}`);
        return stats;
    }
};
exports.CatalogIndexer = CatalogIndexer;
exports.CatalogIndexer = CatalogIndexer = CatalogIndexer_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __param(2, (0, common_1.Inject)(exports.EMBEDDING_PORT)),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        clinic_profile_service_1.ClinicProfileService, Object])
], CatalogIndexer);
function toVectorLiteral(v) {
    return `[${v.join(',')}]`;
}
//# sourceMappingURL=catalog-indexer.service.js.map