"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemorySessionStore = void 0;
class InMemorySessionStore {
    constructor(now = Date.now) {
        this.now = now;
        this.items = new Map();
    }
    async get(id) {
        return this.items.get(id)?.value;
    }
    async set(id, value) {
        this.items.set(id, { value, touchedAt: this.now() });
    }
    async delete(id) {
        this.items.delete(id);
    }
    async evictOlderThan(ttlMs) {
        const border = this.now() - ttlMs;
        let removed = 0;
        for (const [id, item] of this.items) {
            if (item.touchedAt < border) {
                this.items.delete(id);
                removed++;
            }
        }
        return removed;
    }
}
exports.InMemorySessionStore = InMemorySessionStore;
//# sourceMappingURL=session-store.port.js.map