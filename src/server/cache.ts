interface CacheEntry {
  data: unknown;
  expiry: number;
}

const cache = new Map<string, CacheEntry>();

export function getCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key: string, data: unknown, ttlMinutes = 10): void {
  cache.set(key, {
    data,
    expiry: Date.now() + ttlMinutes * 60 * 1000,
  });
}

export function clearCache(): void {
  cache.clear();
}

export function getCacheStats() {
  let active = 0;
  let expired = 0;
  const now = Date.now();
  for (const [, entry] of cache) {
    if (now > entry.expiry) expired++;
    else active++;
  }
  return { total: cache.size, active, expired };
}
