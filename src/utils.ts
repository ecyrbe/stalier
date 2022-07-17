import type { StalierOptions } from './stalier.types';

export function warn(logger: StalierOptions['logger'], err: unknown, key: string) {
  if (err instanceof Error) {
    logger?.warn(`Error updating cache for key ${key}: ${err.message}`);
  } else {
    logger?.warn(`Error updating cache for key ${key}`);
  }
}

export function isCacheFresh(
  cached: { updatedCount: number; lastUpdated: number; value: unknown },
  maxAge: number,
  now: number,
) {
  return cached.lastUpdated + maxAge * 1000 > now;
}

export function isCacheStale(
  cached: { updatedCount: number; lastUpdated: number; value: unknown },
  maxAge: number,
  staleWhileRevalidate: number,
  now: number,
) {
  return cached.lastUpdated + (maxAge + staleWhileRevalidate) * 1000 > now;
}
