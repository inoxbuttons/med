import { CatalogSearch, decide, relevantHits, SearchHit } from '../catalog/catalog-search.service';
import { FrameEntities } from '../nlu/frame';
import { normalize, words } from '../catalog/text';
import { ClinicProfile } from '../profile/clinic-profile';
import { Target } from './dialog-state';

export type TargetResolution =
  | { kind: 'single'; target: Target; note?: string }
  | { kind: 'choice'; targets: Target[] }
  /** Слишком много услуг из разных областей — сначала спросить область. */
  | { kind: 'areas'; areas: Array<{ label: string; aliases: string[]; targets: Target[] }> }
  | { kind: 'none'; query: string }
  /** В ограничениях нет ни врача, ни специальности, ни услуги, ни симптома. */
  | { kind: 'missing' };

export type CatalogLookup = Pick<CatalogSearch, 'search'>;

const CHILD = /(детск|педиатр|подростк)/i;
const DENTAL = /(стомат|зуб|ортодонт|имплант)/i;

/**
 * Ограничения → кого/что записывать. Порядок: врач по фамилии → услуга → специальность →
 * симптом (подсказки профиля «симптом → специальность»).
 */
export async function resolveTarget(
  e: FrameEntities,
  ctx: { clinicNetId: number; search: CatalogLookup; profile: ClinicProfile },
): Promise<TargetResolution> {
  const { clinicNetId, search } = ctx;

  if (e.doctorName) {
    const hits = await search.search(clinicNetId, e.doctorName, { kinds: ['doctor'], limit: 5 });
    const d = decide(e.doctorName, hits.filter((h) => h.trgm >= 0.3 || h.coverage > 0), 5);
    if (d.kind === 'none') return { kind: 'none', query: e.doctorName };
    if (d.kind === 'single') return { kind: 'single', target: doctorTarget(d.hit) };
    return { kind: 'choice', targets: d.hits.map(doctorTarget) };
  }

  if (e.serviceQuery) {
    const hits = await search.search(clinicNetId, e.serviceQuery, { kinds: ['service'], limit: 60 });
    const relevant = singleFirst(bestCoverage(hits), e.serviceQuery);
    const areas = groupByArea(relevant, e.serviceQuery, ctx.profile);
    if (areas) return { kind: 'areas', areas };
    const d = decide(e.serviceQuery, relevant, 8);
    if (d.kind === 'none') {
      // Пациент мог назвать специальность как услугу («к лору»)
      const asSpec = await resolveSpeciality(e.serviceQuery, e.child, ctx);
      return asSpec ?? { kind: 'none', query: e.serviceQuery };
    }
    if (d.kind === 'single') return { kind: 'single', target: serviceTarget(d.hit) };
    return { kind: 'choice', targets: d.hits.map(serviceTarget) };
  }

  if (e.speciality) {
    return (await resolveSpeciality(e.speciality, e.child, ctx)) ?? { kind: 'none', query: e.speciality };
  }

  if (e.symptom) {
    const hint = symptomSpeciality(e.symptom, ctx.profile);
    if (hint) {
      const r = (await resolveSpeciality(hint.speciality, e.child, ctx)) ?? (hint.fallback ? await resolveSpeciality(hint.fallback, e.child, ctx) : null);
      if (r) return r;
    }
    const fallback = await resolveSpeciality(e.child ? 'педиатр' : 'терапевт', e.child, ctx);
    return fallback ?? { kind: 'none', query: e.symptom };
  }

  return { kind: 'missing' };
}

/** Специальность: все варианты написания с лучшим покрытием объединяются в одну группу врачей. */
async function resolveSpeciality(
  query: string,
  child: boolean | undefined,
  ctx: { clinicNetId: number; search: CatalogLookup },
): Promise<TargetResolution | null> {
  const hits = await ctx.search.search(ctx.clinicNetId, query, { kinds: ['speciality'], limit: 12 });
  let relevant = bestCoverage(hits);
  // «терапевт» не должен находить «стоматолог-терапевт»: стоматология — только если о ней спросили.
  if (!DENTAL.test(query)) relevant = relevant.filter((h) => !DENTAL.test(h.title));
  if (relevant.length === 0) return null;
  // Детский / взрослый приём: оставляем подходящие, если такие есть.
  const kids = relevant.filter((h) => CHILD.test(h.title));
  const adults = relevant.filter((h) => !CHILD.test(h.title));
  if (child && kids.length) relevant = kids;
  else if (child && !/педиатр/i.test(query)) {
    // Детского специалиста этого профиля нет — к педиатру, а не ко взрослому врачу.
    return resolveSpeciality('педиатр', child, ctx);
  } else if (!child && adults.length) relevant = adults;

  const doctorIds = [...new Set(relevant.flatMap((h) => (h.meta.doctorIds as number[]) ?? []))];
  if (doctorIds.length === 0) return null;
  const title = capitalize(child && !CHILD.test(query) ? `детский ${query}` : query);
  return { kind: 'single', target: { kind: 'speciality', title, doctorIds } };
}

export function symptomSpeciality(symptom: string, profile: ClinicProfile): { speciality: string; fallback?: string } | null {
  const s = symptom.toLowerCase();
  const hint = profile.symptomHints.find((h) => h.match.some((m) => s.includes(m.toLowerCase())));
  return hint ? { speciality: hint.speciality, fallback: hint.fallback } : null;
}

/** Результаты с лучшим покрытием слов запроса (если текстом не нашлось — как есть: опечатки, векторы). */
function bestCoverage(hits: SearchHit[]): SearchHit[] {
  return relevantHits(hits);
}

/**
 * Больше 8 услуг из ≥ 2 областей, и область в запросе не названа → группы по областям профиля.
 * Услуга может попасть в несколько областей; услуги без области — в «Другое».
 */
export function groupByArea(hits: SearchHit[], query: string, profile: ClinicProfile) {
  if (hits.length <= 8 || !profile.serviceAreas.length) return null;
  const areaOf = (title: string) => {
    const t = ` ${title.toLowerCase().replace(/\(.*$/, '')} `;
    return profile.serviceAreas.filter((a) => a.match.some((m) => t.includes(m.toLowerCase())));
  };
  if (areaOf(query).length) return null;
  const groups = profile.serviceAreas
    .map((a) => ({ label: a.label, aliases: a.match.filter((m) => m.trim().length >= 4), targets: hits.filter((h) => areaOf(h.title).includes(a)).map(serviceTarget) }))
    .filter((g) => g.targets.length > 0);
  const other = hits.filter((h) => areaOf(h.title).length === 0).map(serviceTarget);
  if (groups.length < 2) return null;
  if (other.length) groups.push({ label: 'Другое', aliases: ['друг'], targets: other });
  return groups;
}

/** Комбинированные услуги («МРТ … + МРТ …») — после одиночных, если пациент не просил комбинацию. */
function singleFirst(hits: SearchHit[], query: string): SearchHit[] {
  // Сначала услуги, где слова запроса — в самом названии, а не только в описании в скобках
  // («МРТ головного мозга» выше «МРТ весь организм (головной мозг, …)»); комбинации — после одиночных.
  const stems = words(query).map((w) => w.slice(0, 5));
  const inTitle = (h: SearchHit) => {
    const t = normalize(h.title.replace(/\(.*$/, ''));
    return stems.length ? stems.filter((s) => t.includes(s)).length / stems.length : 0;
  };
  const combo = (h: SearchHit) => (!query.includes('+') && h.title.includes(' + ') ? 1 : 0);
  return hits
    .map((h, i) => ({ h, i, t: inTitle(h), c: combo(h) }))
    .sort((a, b) => b.t - a.t || a.c - b.c || a.i - b.i)
    .map((x) => x.h);
}

function doctorTarget(h: SearchHit): Target {
  return { kind: 'doctor', doctorId: Number(h.entityId), name: h.title, speciality: h.meta.speciality };
}

function serviceTarget(h: SearchHit): Target {
  const id = /^\d+$/.test(h.entityId) ? Number(h.entityId) : h.entityId;
  return {
    kind: 'service',
    serviceId: id,
    name: h.title,
    selfBooking: !!h.meta.selfBooking,
    atDoctorVisit: !!h.meta.atDoctorVisit,
    direction: h.meta.direction ?? null,
    clinics: h.meta.clinics ?? [],
    priceFrom: !!h.meta.priceFrom,
  };
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
