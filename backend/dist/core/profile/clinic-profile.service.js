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
var ClinicProfileService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicProfileService = void 0;
exports.clinicsRoot = clinicsRoot;
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const common_1 = require("@nestjs/common");
const clinic_profile_1 = require("./clinic-profile");
function clinicsRoot() {
    const candidates = [
        process.env.CLINICS_DIR,
        path.resolve(__dirname, '../../clinics'),
        path.resolve(__dirname, '../../../src/clinics'),
    ].filter(Boolean);
    const found = candidates.find((p) => fs.existsSync(path.join(p, 'core', 'profile.yaml')));
    if (!found)
        throw new Error(`Каталог clinics не найден: ${candidates.join(', ')}`);
    return found;
}
let ClinicProfileService = ClinicProfileService_1 = class ClinicProfileService {
    constructor(root = clinicsRoot()) {
        this.root = root;
        this.logger = new common_1.Logger(ClinicProfileService_1.name);
        this.byNet = new Map();
    }
    onModuleInit() {
        this.reload();
    }
    reload() {
        const base = this.readYaml(path.join(this.root, 'core', 'profile.yaml'));
        this.defaults = clinic_profile_1.clinicProfileSchema.parse({ slug: 'default', clinicNetId: null, ...base });
        const byNet = new Map();
        const netsDir = path.join(this.root, 'nets');
        const slugs = fs.existsSync(netsDir) ? fs.readdirSync(netsDir).filter((d) => fs.statSync(path.join(netsDir, d)).isDirectory()) : [];
        for (const slug of slugs) {
            const file = path.join(netsDir, slug, 'profile.yaml');
            if (!fs.existsSync(file))
                continue;
            const own = this.readYaml(file);
            const merged = clinic_profile_1.clinicProfileSchema.parse((0, clinic_profile_1.mergeProfile)({ ...this.defaults, slug }, own));
            if (merged.clinicNetId === null)
                throw new Error(`${file}: не указан clinicNetId`);
            if (byNet.has(merged.clinicNetId))
                throw new Error(`${file}: clinicNetId ${merged.clinicNetId} уже занят`);
            byNet.set(merged.clinicNetId, merged);
        }
        this.byNet = byNet;
        this.logger.log(`Профили сетей: ${[...byNet.values()].map((p) => `${p.clinicNetId}=${p.slug}`).join(', ') || 'нет'}`);
    }
    forNet(clinicNetId) {
        if (!this.defaults)
            this.reload();
        return (clinicNetId != null && this.byNet.get(clinicNetId)) || this.defaults;
    }
    readYaml(file) {
        const data = yaml.load(fs.readFileSync(file, 'utf-8'));
        if (data == null)
            return {};
        if (typeof data !== 'object' || Array.isArray(data))
            throw new Error(`${file}: ожидается объект`);
        return data;
    }
};
exports.ClinicProfileService = ClinicProfileService;
exports.ClinicProfileService = ClinicProfileService = ClinicProfileService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [String])
], ClinicProfileService);
//# sourceMappingURL=clinic-profile.service.js.map