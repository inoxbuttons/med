/**
 * Хранилище состояния диалога. Сейчас — память процесса; порт позволяет перейти
 * на Redis/Postgres, чтобы сессии переживали перезапуск.
 */
export interface SessionStore<T> {
  get(id: string): Promise<T | undefined>;
  set(id: string, value: T): Promise<void>;
  delete(id: string): Promise<void>;
  /** Удалить сессии, не обновлявшиеся дольше ttlMs. Возвращает число удалённых. */
  evictOlderThan(ttlMs: number): Promise<number>;
}

export class InMemorySessionStore<T> implements SessionStore<T> {
  private readonly items = new Map<string, { value: T; touchedAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async get(id: string): Promise<T | undefined> {
    return this.items.get(id)?.value;
  }

  async set(id: string, value: T): Promise<void> {
    this.items.set(id, { value, touchedAt: this.now() });
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async evictOlderThan(ttlMs: number): Promise<number> {
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
