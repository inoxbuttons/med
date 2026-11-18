"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedflexCatalogSource = void 0;
const mapping_1 = require("../shared/mapping");
class MedflexCatalogSource {
    constructor(clinicNetId, mf, ctx) {
        this.clinicNetId = clinicNetId;
        this.mf = mf;
        this.ctx = ctx;
        this.clinicsMemo = new mapping_1.Memo(() => this.mf.getClinics(ctx.client, ctx.lpuGroupId, ctx.townId));
        this.specNames = new mapping_1.Memo(async () => {
            const apiKey = ctx.client.apiKey;
            const specs = await this.mf.getCachedSpecialities(ctx.client, apiKey);
            return new Map(specs.map((s) => [s.id, s.name]));
        });
    }
    clinics() {
        return this.clinicsMemo.get();
    }
    async clinicIds() {
        return (await this.clinics()).map((c) => c.id);
    }
    async inNet(clinicId) {
        return (await this.clinicIds()).includes(clinicId);
    }
    async rawDoctors(doctorIds) {
        const lpuIds = await this.clinicIds();
        if (lpuIds.length === 0)
            return [];
        const out = [];
        for (let page = 1; page <= 20; page++) {
            const res = await this.ctx.client.getDoctors({
                lpuIds: lpuIds.join(','),
                doctorIds: doctorIds?.join(','),
                page,
                size: 100,
            });
            out.push(...res.data);
            if (page >= (res.num_pages ?? 1))
                break;
        }
        return out;
    }
    async doctors() {
        const [raw, clinics, specs] = await Promise.all([this.rawDoctors(), this.clinics(), this.specNames.get()]);
        const clinicName = new Map(clinics.map((c) => [c.id, c.name]));
        return raw.map((d) => {
            const specialityId = d.specialities[0] ?? null;
            const price = d.prices?.find((p) => p.speciality_id === specialityId)?.price;
            return {
                id: d.id,
                name: d.efio,
                speciality: specialityId ? (specs.get(specialityId) ?? '') : '',
                specialityId,
                price: typeof price === 'number' ? price : null,
                clinics: d.lpus.filter((id) => clinicName.has(id)).map((id) => ({ id, name: clinicName.get(id) })),
            };
        });
    }
    async rawServices() {
        const lpuIds = await this.clinicIds();
        return Promise.all(lpuIds.map(async (lpuId) => ({ lpuId, services: await this.ctx.client.getServicePrices({ lpuId }) })));
    }
    async services() {
        const [perLpu, clinics] = await Promise.all([this.rawServices(), this.clinics()]);
        const clinicName = new Map(clinics.map((c) => [c.id, c.name]));
        const byId = new Map();
        for (const { lpuId, services } of perLpu) {
            for (const s of services) {
                let svc = byId.get(s.id);
                if (!svc) {
                    svc = { id: s.id, name: s.name, direction: null, selfBooking: true, atDoctorVisit: false, stationary: false, priceFrom: false, clinics: [] };
                    byId.set(s.id, svc);
                }
                svc.clinics.push({ id: lpuId, name: clinicName.get(lpuId) ?? `Клиника #${lpuId}`, price: s.price ?? null });
            }
        }
        return [...byId.values()];
    }
    async searchDoctors(query, clinicId) {
        const found = await this.mf.findDoctors(this.ctx.client, query, this.ctx.lpuGroupId, clinicId, this.ctx.townId);
        return found.map(mapping_1.doctorFromInfo);
    }
    async searchServices(query, clinicId) {
        const q = query.toLowerCase().trim();
        return (await this.services())
            .filter((s) => s.name.toLowerCase().includes(q))
            .filter((s) => !clinicId || s.clinics.some((c) => c.id === clinicId));
    }
}
exports.MedflexCatalogSource = MedflexCatalogSource;
//# sourceMappingURL=medflex-catalog.source.js.map