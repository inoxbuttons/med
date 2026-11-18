import { Slot, SlotMode } from '../domain';
import { FrameEntities } from '../nlu/frame';
export declare function slotWindow(e: FrameEntities, now?: Date): {
    mode: SlotMode;
    date?: string;
};
export declare function targetDate(e: FrameEntities, now?: Date): string | undefined;
export declare function filterSlots(slots: Slot[], e: FrameEntities, now?: Date): Slot[];
export declare function byTime(slots: Slot[], time: string): {
    exact: Slot | null;
    near: Slot[];
};
