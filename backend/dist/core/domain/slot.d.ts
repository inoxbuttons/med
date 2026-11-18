import { ServiceId } from './catalog';
export type SlotMode = 'nearest' | 'day' | 'week';
export interface SlotQuery {
    doctorId?: number;
    serviceId?: ServiceId;
    clinicId?: number;
    mode?: SlotMode;
    date?: string;
}
export interface Slot {
    start: string;
    end: string | null;
    date: string;
    time: string;
    dateLabel: string;
    clinicId: number;
    clinicName: string;
    doctorId?: number;
    doctorName?: string;
    serviceId?: ServiceId;
    ref?: string;
}
