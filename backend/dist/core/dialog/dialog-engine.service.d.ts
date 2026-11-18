import { BookingPort, CatalogSourcePort, MisKind } from '../ports';
import { Frame } from '../nlu/frame';
import { NluResult } from '../nlu/nlu.service';
import { ClinicProfile } from '../profile/clinic-profile';
import { LlmUsage } from '../../llm/llm.types';
import { AnswerResult } from './answer.service';
import { DialogSession } from './dialog-state';
import { Reply, shortName } from './render';
import { CatalogLookup } from './target-resolver';
export interface EngineDeps {
    nlu: {
        parse(text: string, ctx: any): Promise<NluResult>;
    };
    answers: {
        answer(q: string, facts: string, ctx: any): Promise<AnswerResult>;
        symptoms(complaint: string, speciality: string, ctx: any): Promise<AnswerResult>;
        agent(q: string, catalog: CatalogSourcePort, ctx: any): Promise<AnswerResult>;
    };
    search: CatalogLookup;
    adapters(clinicNetId: number, opts: {
        townId?: number;
    }): Promise<{
        mis: MisKind;
        booking: BookingPort;
        catalog: CatalogSourcePort;
    }>;
    profile(clinicNetId: number): ClinicProfile;
    onUsage?(session: DialogSession, task: string, usage: LlmUsage, promptHash?: string): void;
    now?(): Date;
}
export declare class DialogEngine {
    private readonly deps;
    private readonly logger;
    constructor(deps: EngineDeps);
    handle(session: DialogSession, input: {
        text: string;
        payload?: string;
    }): Promise<Reply>;
    private understand;
    private process;
    private advance;
    private finish;
    private withoutRestatedSubject;
    private mergeEntities;
    private applyOption;
    private onReply;
    private book;
    private pickSlot;
    private loadSlots;
    private forAge;
    private byClinic;
    private referral;
    private operatorRequest;
    private doBook;
    private replaceConflicting;
    private info;
    private price;
    private listAppointments;
    private myAppointments;
    private changeAppointment;
    private doCancel;
    private doReschedule;
    private freeAnswer;
    private offer;
    private askPatientData;
    private missingPatientFields;
    private patient;
    private summary;
    private answerCtx;
    private usage;
    private say;
    private now;
}
export declare function payloadFrame(payload?: string): Frame | null;
export { shortName };
