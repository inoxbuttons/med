import { CatalogSearch, SearchHit } from '../catalog/catalog-search.service';
import { FrameEntities } from '../nlu/frame';
import { ClinicProfile } from '../profile/clinic-profile';
import { Target } from './dialog-state';
export type TargetResolution = {
    kind: 'single';
    target: Target;
    note?: string;
} | {
    kind: 'choice';
    targets: Target[];
} | {
    kind: 'areas';
    areas: Array<{
        label: string;
        aliases: string[];
        targets: Target[];
    }>;
} | {
    kind: 'none';
    query: string;
} | {
    kind: 'missing';
};
export type CatalogLookup = Pick<CatalogSearch, 'search'>;
export declare function resolveTarget(e: FrameEntities, ctx: {
    clinicNetId: number;
    search: CatalogLookup;
    profile: ClinicProfile;
}): Promise<TargetResolution>;
export declare function symptomSpeciality(symptom: string, profile: ClinicProfile): {
    speciality: string;
    fallback?: string;
} | null;
export declare function groupByArea(hits: SearchHit[], query: string, profile: ClinicProfile): {
    label: string;
    aliases: string[];
    targets: Target[];
}[];
