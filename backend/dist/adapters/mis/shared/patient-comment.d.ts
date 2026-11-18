import { PatientIdentity } from '../../../core/domain';
export declare function fullName(p: PatientIdentity): string | null;
export declare function bookingComment(patient: PatientIdentity, comment?: string, extra?: string): string | undefined;
