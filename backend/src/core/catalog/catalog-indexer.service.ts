import * as crypto from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Doctor, Service } from '../domain';
import { CatalogSourcePort } from '../ports';
import { EmbeddingPort } from '../ports/embedding.port';
import { ClinicProfileService } from '../profile/clinic-profile.service';
import { expandForIndex, normalize } from './text';

export const EMBEDDING_PORT = Symbol('EMBEDDING_PORT');

export type CatalogKind = 'service' | 'speciality' | 'doctor';

export interface IndexDoc {
  kind: CatalogKind;
  entityId: string;
  title: string;
  searchText: string;
  meta: Record<string, unknown>;
}

export interface ReindexStats {
  clinicNetId: number;
  total: number;
  upserted: number;
  deleted: number;
  embedded: number;
}

/** Документы индекса из каталога сети. Чистая функция — тестируется без БД. */
export function buildIndexDocs(
  services: Service[],
  doctors: Doctor[],
  synonyms: Record<string, string[]>,
): IndexDoc[] {
  const docs: IndexDoc[] = [];

  for (const s of services) {
    const clinicIds = s.clinics.map((c) => c.id);
    docs.push({
      kind: 'service',
      entityId: String(s.id),
      title: s.name,
      searchText: expandForIndex([s.name, s.direction].filter(Boolean).join(' · '), synonyms),
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

  const specs = new Map<string, { title: string; doctorIds: number[]; clinicIds: Set<number> }>();
  for (const d of doctors) {
    const clinicIds = d.clinics.map((c) => c.id);
    docs.push({
      kind: 'doctor',
      entityId: String(d.id),
      title: d.name,
      searchText: expandForIndex(`${d.name} · ${d.speciality}`, synonyms),
      meta: { speciality: d.speciality, specialityId: d.specialityId, price: d.price, clinics: d.clinics, clinicIds },
    });
    if (!d.speciality) continue;
    const key = normalize(d.speciality);
    const spec = specs.get(key) ?? { title: d.speciality.trim(), doctorIds: [], clinicIds: new Set<number>() };
    spec.doctorIds.push(d.id);
    clinicIds.forEach((id) => spec.clinicIds.add(id));
    specs.set(key, spec);
  }

  for (const [key, spec] of specs) {
    docs.push({
      kind: 'speciality',
      entityId: key.slice(0, 255),
      title: spec.title,
      searchText: expandForIndex(spec.title, synonyms),
      meta: { doctorIds: spec.doctorIds, clinicIds: [...spec.clinicIds] },
    });
  }
  return docs;
}

export function contentHash(doc: IndexDoc): string {
  return crypto.createHash('sha1').update(`${doc.title}\n${doc.searchText}`).digest('hex');
}

/**
 * Строит catalog_index сети. Текст и meta обновляются всегда (дёшево),
 * эмбеддинги — только для документов с новым текстом (если эмбеддинги включены).
 */
@Injectable()
export class CatalogIndexer {
  private readonly logger = new Logger(CatalogIndexer.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly profiles: ClinicProfileService,
    @Inject(EMBEDDING_PORT) private readonly embeddings: EmbeddingPort,
  ) {}

  async reindex(catalog: CatalogSourcePort, opts: { embed?: boolean } = {}): Promise<ReindexStats> {
    const netId = catalog.clinicNetId;
    const profile = this.profiles.forNet(netId);
    const [services, doctors] = await Promise.all([catalog.services(), catalog.doctors()]);
    const docs = buildIndexDocs(services, doctors, profile.synonyms);

    const existing: Array<{ kind: string; entity_id: string; content_hash: string; has_vec: boolean; embedding_model: string | null }> =
      await this.db.query(
        `SELECT kind, entity_id, content_hash, embedding IS NOT NULL AS has_vec, embedding_model
           FROM catalog_index WHERE clinic_net_id = $1`,
        [netId],
      );
    const prev = new Map(existing.map((r) => [`${r.kind}:${r.entity_id}`, r]));

    let upserted = 0;
    const toEmbed: Array<{ doc: IndexDoc; hash: string }> = [];
    for (const doc of docs) {
      const hash = contentHash(doc);
      const old = prev.get(`${doc.kind}:${doc.entityId}`);
      const textChanged = !old || old.content_hash !== hash;
      await this.db.query(
        `INSERT INTO catalog_index (clinic_net_id, kind, entity_id, title, search_text, content_hash, meta, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (clinic_net_id, kind, entity_id) DO UPDATE SET
           title = EXCLUDED.title, search_text = EXCLUDED.search_text, meta = EXCLUDED.meta, updated_at = now(),
           content_hash = EXCLUDED.content_hash,
           embedding = CASE WHEN catalog_index.content_hash = EXCLUDED.content_hash THEN catalog_index.embedding END,
           embedding_model = CASE WHEN catalog_index.content_hash = EXCLUDED.content_hash THEN catalog_index.embedding_model END`,
        [netId, doc.kind, doc.entityId, doc.title, doc.searchText, hash, JSON.stringify(doc.meta)],
      );
      upserted++;
      const staleModel = old?.embedding_model && old.embedding_model !== this.embeddings.model;
      if (textChanged || !old?.has_vec || staleModel) toEmbed.push({ doc, hash });
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
        await this.db.query(
          `UPDATE catalog_index SET embedding = $1::vector, embedding_model = $2
            WHERE clinic_net_id = $3 AND kind = $4 AND entity_id = $5 AND content_hash = $6`,
          [toVectorLiteral(vectors[i]), this.embeddings.model, netId, doc.kind, doc.entityId, hash],
        );
        embedded++;
      }
    }

    const stats = { clinicNetId: netId, total: docs.length, upserted, deleted: gone.length, embedded };
    this.logger.log(`catalog_index сеть ${netId}: ${JSON.stringify(stats)}; без эмбеддинга: ${toEmbed.length - embedded}`);
    return stats;
  }
}

export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
