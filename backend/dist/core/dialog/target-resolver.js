"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTarget = resolveTarget;
exports.symptomSpeciality = symptomSpeciality;
exports.groupByArea = groupByArea;
const catalog_search_service_1 = require("../catalog/catalog-search.service");
const text_1 = require("../catalog/text");
const CHILD = /(детск|педиатр|подростк)/i;
const DENTAL = /(стомат|зуб|ортодонт|имплант)/i;
async function resolveTarget(e, ctx) {
    const { clinicNetId, search } = ctx;
    if (e.doctorName) {
        const hits = await search.search(clinicNetId, e.doctorName, { kinds: ['doctor'], limit: 5 });
        const d = (0, catalog_search_service_1.decide)(e.doctorName, hits.filter((h) => h.trgm >= 0.3 || h.coverage > 0), 5);
        if (d.kind === 'none')
            return { kind: 'none', query: e.doctorName };
        if (d.kind === 'single')
            return { kind: 'single', target: doctorTarget(d.hit) };
        return { kind: 'choice', targets: d.hits.map(doctorTarget) };
    }
    if (e.serviceQuery) {
        const hits = await search.search(clinicNetId, e.serviceQuery, { kinds: ['service'], limit: 60 });
        const relevant = singleFirst(bestCoverage(hits), e.serviceQuery);
        const areas = groupByArea(relevant, e.serviceQuery, ctx.profile);
        if (areas)
            return { kind: 'areas', areas };
        const d = (0, catalog_search_service_1.decide)(e.serviceQuery, relevant, 8);
        if (d.kind === 'none') {
            const asSpec = await resolveSpeciality(e.serviceQuery, e.child, ctx);
            return asSpec ?? { kind: 'none', query: e.serviceQuery };
        }
        if (d.kind === 'single')
            return { kind: 'single', target: serviceTarget(d.hit) };
        return { kind: 'choice', targets: d.hits.map(serviceTarget) };
    }
    if (e.speciality) {
        return (await resolveSpeciality(e.speciality, e.child, ctx)) ?? { kind: 'none', query: e.speciality };
    }
    if (e.symptom) {
        const hint = symptomSpeciality(e.symptom, ctx.profile);
        if (hint) {
            const r = (await resolveSpeciality(hint.speciality, e.child, ctx)) ?? (hint.fallback ? await resolveSpeciality(hint.fallback, e.child, ctx) : null);
            if (r)
                return r;
        }
        const fallback = await resolveSpeciality(e.child ? 'педиатр' : 'терапевт', e.child, ctx);
        return fallback ?? { kind: 'none', query: e.symptom };
    }
    return { kind: 'missing' };
}
async function resolveSpeciality(query, child, ctx) {
    const hits = await ctx.search.search(ctx.clinicNetId, query, { kinds: ['speciality'], limit: 12 });
    let relevant = bestCoverage(hits);
    if (!DENTAL.test(query))
        relevant = relevant.filter((h) => !DENTAL.test(h.title));
    if (relevant.length === 0)
        return null;
    const kids = relevant.filter((h) => CHILD.test(h.title));
    const adults = relevant.filter((h) => !CHILD.test(h.title));
    if (child && kids.length)
        relevant = kids;
    else if (child && !/педиатр/i.test(query)) {
        return resolveSpeciality('педиатр', child, ctx);
    }
    else if (!child && adults.length)
        relevant = adults;
    const doctorIds = [...new Set(relevant.flatMap((h) => h.meta.doctorIds ?? []))];
    if (doctorIds.length === 0)
        return null;
    const title = capitalize(child && !CHILD.test(query) ? `детский ${query}` : query);
    return { kind: 'single', target: { kind: 'speciality', title, doctorIds } };
}
function symptomSpeciality(symptom, profile) {
    const s = symptom.toLowerCase();
    const hint = profile.symptomHints.find((h) => h.match.some((m) => s.includes(m.toLowerCase())));
    return hint ? { speciality: hint.speciality, fallback: hint.fallback } : null;
}
function bestCoverage(hits) {
    return (0, catalog_search_service_1.relevantHits)(hits);
}
function groupByArea(hits, query, profile) {
    if (hits.length <= 8 || !profile.serviceAreas.length)
        return null;
    const areaOf = (title) => {
        const t = ` ${title.toLowerCase().replace(/\(.*$/, '')} `;
        return profile.serviceAreas.filter((a) => a.match.some((m) => t.includes(m.toLowerCase())));
    };
    if (areaOf(query).length)
        return null;
    const groups = profile.serviceAreas
        .map((a) => ({ label: a.label, aliases: a.match.filter((m) => m.trim().length >= 4), targets: hits.filter((h) => areaOf(h.title).includes(a)).map(serviceTarget) }))
        .filter((g) => g.targets.length > 0);
    const other = hits.filter((h) => areaOf(h.title).length === 0).map(serviceTarget);
    if (groups.length < 2)
        return null;
    if (other.length)
        groups.push({ label: 'Другое', aliases: ['друг'], targets: other });
    return groups;
}
function singleFirst(hits, query) {
    const stems = (0, text_1.words)(query).map((w) => w.slice(0, 5));
    const inTitle = (h) => {
        const t = (0, text_1.normalize)(h.title.replace(/\(.*$/, ''));
        return stems.length ? stems.filter((s) => t.includes(s)).length / stems.length : 0;
    };
    const combo = (h) => (!query.includes('+') && h.title.includes(' + ') ? 1 : 0);
    return hits
        .map((h, i) => ({ h, i, t: inTitle(h), c: combo(h) }))
        .sort((a, b) => b.t - a.t || a.c - b.c || a.i - b.i)
        .map((x) => x.h);
}
function doctorTarget(h) {
    return { kind: 'doctor', doctorId: Number(h.entityId), name: h.title, speciality: h.meta.speciality };
}
function serviceTarget(h) {
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
function capitalize(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
}
//# sourceMappingURL=target-resolver.js.map