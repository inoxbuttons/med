import { InMemorySessionStore } from './session-store.port';

describe('InMemorySessionStore', () => {
  it('хранит, удаляет и вытесняет по TTL', async () => {
    let now = 1_000;
    const store = new InMemorySessionStore<{ n: number }>(() => now);
    await store.set('a', { n: 1 });
    now = 5_000;
    await store.set('b', { n: 2 });
    expect(await store.get('a')).toEqual({ n: 1 });

    now = 6_000;
    expect(await store.evictOlderThan(3_000)).toBe(1); // 'a' обновлена в 1000 < 3000
    expect(await store.get('a')).toBeUndefined();
    expect(await store.get('b')).toEqual({ n: 2 });

    await store.delete('b');
    expect(await store.get('b')).toBeUndefined();
  });
});
