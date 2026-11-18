"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalCatalogSource = void 0;
const mapping_1 = require("../shared/mapping");
class LocalCatalogSource {
    constructor(clinicNetId, local, db) {
        this.clinicNetId = clinicNetId;
        this.local = local;
        this.db = db;
        this.clinicsMemo = new mapping_1.Memo(() => this.local.getClinics(this.clinicNetId));
        this.doctorNames = new mapping_1.Memo(async () => new Map((await this.doctors()).map((d) => [d.id, d.name])));
    }
    async doctorName(id) {
        return (await this.doctorNames.get()).get(id);
    }
    clinics() {
        return this.clinicsMemo.get();
    }
    async clinicIds() {
        return new Set((await this.clinics()).map((c) => c.id));
    }
    async inNet(clinicId) {
        return (await this.clinicIds()).has(clinicId);
    }
    async doctors() {
        return (await this.local.findDoctors('', undefined, this.clinicNetId)).map(mapping_1.doctorFromInfo);
    }
    async services() {
        const rows = await this.db.query(`SELECT s.id, s.name, mf.name AS direction, s.self_booking, s.at_doctor_visit, s.stationary, s.price_from,
              c.id AS clinic_id, c.name AS clinic_name, sbc.price
         FROM services s
         JOIN services_by_clinics sbc ON sbc.service_id = s.id
         JOIN clinics c ON c.id = sbc.clinic_id
         LEFT JOIN med_fields mf ON mf.id = s.med_field_id
        WHERE c.clinic_net_id = $1
        ORDER BY s.id, c.id`, [this.clinicNetId]);
        const byId = new Map();
        for (const r of rows) {
            let s = byId.get(r.id);
            if (!s) {
                s = {
                    id: r.id,
                    name: r.name,
                    direction: r.direction,
                    selfBooking: r.self_booking,
                    atDoctorVisit: r.at_doctor_visit,
                    stationary: r.stationary,
                    priceFrom: r.price_from,
                    clinics: [],
                };
                byId.set(r.id, s);
            }
            s.clinics.push({ id: r.clinic_id, name: r.clinic_name, price: r.price === null ? null : Number(r.price) || null });
        }
        return [...byId.values()];
    }
    async searchDoctors(query, clinicId) {
        return (await this.local.findDoctors(query, clinicId, this.clinicNetId)).map(mapping_1.doctorFromInfo);
    }
    async searchServices(query, clinicId) {
        return this.local.findServices(query, clinicId, this.clinicNetId);
    }
}
exports.LocalCatalogSource = LocalCatalogSource;
//# sourceMappingURL=local-catalog.source.js.map