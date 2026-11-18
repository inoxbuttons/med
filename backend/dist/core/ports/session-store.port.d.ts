export interface SessionStore<T> {
    get(id: string): Promise<T | undefined>;
    set(id: string, value: T): Promise<void>;
    delete(id: string): Promise<void>;
    evictOlderThan(ttlMs: number): Promise<number>;
}
export declare class InMemorySessionStore<T> implements SessionStore<T> {
    private readonly now;
    private readonly items;
    constructor(now?: () => number);
    get(id: string): Promise<T | undefined>;
    set(id: string, value: T): Promise<void>;
    delete(id: string): Promise<void>;
    evictOlderThan(ttlMs: number): Promise<number>;
}
