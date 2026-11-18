import { Appointment, Slot, VisitService } from '../domain';
import { ClinicProfile } from '../profile/clinic-profile';
import { Option, Target } from './dialog-state';
export interface QuickReply {
    label: string;
    payload?: string;
}
export interface Reply {
    text: string;
    quickReplies?: QuickReply[];
}
export declare const DEFAULT_TEMPLATES: Record<string, string>;
export declare class Templates {
    private readonly profile;
    constructor(profile: ClinicProfile);
    t(key: keyof typeof DEFAULT_TEMPLATES | string, vars?: Record<string, string | number>): string;
}
export declare function slotLabel(s: Slot, withDoctor?: boolean, withClinic?: boolean): string;
export declare function shortName(full: string): string;
export declare function targetLabel(t: Target): string;
export declare function shortServiceName(name: string): string;
export declare function appointmentLabel(a: Appointment): string;
export declare function visitLabel(v: VisitService, showPrice: boolean): string;
export declare function numbered(options: Option[]): string;
export declare function choiceButtons(options: Option[], max?: number): QuickReply[];
export declare const YES_NO: QuickReply[];
