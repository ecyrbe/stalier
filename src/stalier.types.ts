type StalierCacheValue = {
  updatedCount: number;
  lastUpdated: number;
  value: unknown;
};

interface StalierCacheClient {
  get(key: string): Promise<StalierCacheValue>;
  set(key: string, value: StalierCacheValue): Promise<void>;
}

interface StalierWarningLogger {
  warn(message: string): void;
}

export type StalierOptions = {
  maxAge?: number; // in seconds
  staleWhileRevalidate?: number; // in seconds
  logger?: StalierWarningLogger;
  cacheKey: string | (() => string);
  cacheClient: StalierCacheClient;
};

export type StalierResult<T> = {
  data: T;
  status: 'HIT' | 'MISS' | 'STALE' | 'NO_CACHE';
};
