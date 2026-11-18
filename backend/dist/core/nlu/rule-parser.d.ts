import { Frame, FrameEntities } from './frame';
export type Expectation = {
    kind: 'none';
} | {
    kind: 'confirm';
} | {
    kind: 'yes_no';
    field: 'hasReferral' | 'proceed';
} | {
    kind: 'choice';
    options: Array<{
        label: string;
        aliases?: string[];
    }>;
} | {
    kind: 'visit_type';
} | {
    kind: 'date';
} | {
    kind: 'patient_data';
    fields: Array<'fullName' | 'phone' | 'birthday'>;
};
export declare function parseByRules(text: string, exp: Expectation): Frame | null;
export declare function yesNo(t: string): 'yes' | 'no' | null;
export declare function parseChoice(t: string, options: Array<{
    label: string;
    aliases?: string[];
}>): number | null;
export declare function parseTime(t: string): string | null;
export declare function parseDay(t: string): Pick<FrameEntities, 'dayOfWeek' | 'relativeDay' | 'nextWeek'> | null;
export declare function parsePatientData(t: string): Pick<FrameEntities, 'lastName' | 'firstName' | 'secondName' | 'phone' | 'birthday'>;
