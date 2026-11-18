import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClinicProfile, clinicProfileSchema, mergeProfile } from './clinic-profile';

/** Корень с профилями и промптами: dist/clinics (сборка) или src/clinics (тесты, ts-node). */
export function clinicsRoot(): string {
  const candidates = [
    process.env.CLINICS_DIR,
    path.resolve(__dirname, '../../clinics'),
    path.resolve(__dirname, '../../../src/clinics'),
  ].filter(Boolean) as string[];
  const found = candidates.find((p) => fs.existsSync(path.join(p, 'core', 'profile.yaml')));
  if (!found) throw new Error(`Каталог clinics не найден: ${candidates.join(', ')}`);
  return found;
}

/**
 * Профили сетей из репозитория: src/clinics/core/profile.yaml (по умолчанию) +
 * src/clinics/nets/<slug>/profile.yaml (clinicNetId внутри файла).
 * Профиль проверяется схемой при загрузке — ошибка в YAML останавливает старт.
 */
@Injectable()
export class ClinicProfileService implements OnModuleInit {
  private readonly logger = new Logger(ClinicProfileService.name);
  private defaults!: ClinicProfile;
  private byNet = new Map<number, ClinicProfile>();

  constructor(private readonly root: string = clinicsRoot()) {}

  onModuleInit() {
    this.reload();
  }

  reload(): void {
    const base = this.readYaml(path.join(this.root, 'core', 'profile.yaml'));
    this.defaults = clinicProfileSchema.parse({ slug: 'default', clinicNetId: null, ...base });

    const byNet = new Map<number, ClinicProfile>();
    const netsDir = path.join(this.root, 'nets');
    const slugs = fs.existsSync(netsDir) ? fs.readdirSync(netsDir).filter((d) => fs.statSync(path.join(netsDir, d)).isDirectory()) : [];
    for (const slug of slugs) {
      const file = path.join(netsDir, slug, 'profile.yaml');
      if (!fs.existsSync(file)) continue;
      const own = this.readYaml(file);
      const merged = clinicProfileSchema.parse(mergeProfile({ ...this.defaults, slug }, own));
      if (merged.clinicNetId === null) throw new Error(`${file}: не указан clinicNetId`);
      if (byNet.has(merged.clinicNetId)) throw new Error(`${file}: clinicNetId ${merged.clinicNetId} уже занят`);
      byNet.set(merged.clinicNetId, merged);
    }
    this.byNet = byNet;
    this.logger.log(`Профили сетей: ${[...byNet.values()].map((p) => `${p.clinicNetId}=${p.slug}`).join(', ') || 'нет'}`);
  }

  /** Профиль сети; для сети без файла — профиль по умолчанию. */
  forNet(clinicNetId?: number | null): ClinicProfile {
    if (!this.defaults) this.reload();
    return (clinicNetId != null && this.byNet.get(clinicNetId)) || this.defaults;
  }

  private readYaml(file: string): Record<string, unknown> {
    const data = yaml.load(fs.readFileSync(file, 'utf-8'));
    if (data == null) return {};
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error(`${file}: ожидается объект`);
    return data as Record<string, unknown>;
  }
}
