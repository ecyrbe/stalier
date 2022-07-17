import type { StalierOptions, StalierResult } from './stalier.types';
import { isCacheFresh, isCacheStale, warn } from './utils';

/**
 * function to convert cache key to string
 * @param cacheKey - key or function that returns a key to use for cache
 * @returns string to use as cache key
 */
function asKeyString(cacheKey: string | (() => string)) {
  if (typeof cacheKey === 'string') {
    return cacheKey;
  }
  return cacheKey();
}

/**
 * async function to set cache without blocking called
 * @param key - key to use for cache
 * @param updatedCount - number of times cache has been updated
 * @param value - value to cache
 * @param now - current time in milliseconds
 * @param options - options for stale while revalidate
 */
async function setCache<T>(key: string, updatedCount: number, value: T, now: number, options: StalierOptions) {
  try {
    await options.cacheClient.set(key, {
      updatedCount,
      lastUpdated: now,
      value,
    });
  } catch (err) {
    // failure to set to cache is not a critical error
    warn(options.logger, err, key);
  }
}

/**
 * function to revalidate cache in the background
 * @param fn - function to cache result from
 * @param count - number of times fn has been called
 * @param now - current time in milliseconds
 * @param options - options for stale while revalidate
 */
async function revalidateCache<T>(fn: () => Promise<T>, count: number, now: number, options: StalierOptions) {
  const { cacheKey, logger = console } = options;
  const key = asKeyString(cacheKey);
  try {
    const result = await fn();
    setCache(key, count, result, now, options);
  } catch (err) {
    warn(logger, err, key);
  }
}

/**
 * stale while revalidate function
 * @example
 * const { data, status } = await withStaleWhileRevalidate(fn, {
 *   maxAge: 1,
 *   staleWhileRevalidate: 999,
 *   cacheKey: 'cacheKey',
 *   cacheProvider: redisClient,
 * });
 * @param fn - function to cache result from
 * @param options - options for stale while revalidate
 * @returns result of fn either from cache or from fn
 * @throws error only if fn throws error
 */
export async function withStaleWhileRevalidate<T>(
  fn: () => Promise<T>,
  options: StalierOptions,
): Promise<StalierResult<T>> {
  const { maxAge = 0, staleWhileRevalidate = 0, logger = console, cacheKey, cacheClient } = options;
  let updatedCount = 0;
  if (maxAge || staleWhileRevalidate) {
    const key = asKeyString(cacheKey);
    try {
      const cached = await cacheClient.get(key);
      if (cached) {
        const now = Date.now();
        if (isCacheFresh(cached, maxAge, now)) {
          return { data: cached.value as T, status: 'HIT' };
        }
        updatedCount = cached.updatedCount + 1;
        if (isCacheStale(cached, maxAge, staleWhileRevalidate, now)) {
          // revalidate asynchronously to avoid blocking the caller.
          revalidateCache<T>(fn, updatedCount, now, options);
          return { data: cached.value as T, status: 'STALE' };
        }
      }
    } catch (err) {
      // failure to get from cache is the same as a cache MISS
      warn(logger, err, key);
    }

    const result = await fn();
    // set cache asynchronously to avoid blocking the caller
    setCache(key, updatedCount, result, Date.now(), options);
    return { data: result, status: 'MISS' };
  }
  return { data: await fn(), status: 'NO_CACHE' };
}
