import { CacheStore, CacheStoreFactory } from '@nestjs/common';
import { KeyGenFn } from '../common/types';

export interface StalierCacheManagerOptions {
  /**
   * cache-manager store to use
   */
  store: 'memory' | 'none' | CacheStore | CacheStoreFactory;
  /**
   * maximum number of items to store in the cache - only for memory cache
   */
  max?: number;
  /**
   * time to live in seconds - if not set no ttl is set by default
   */
  ttl?: number;
}

export interface StalierModuleOptions {
  /**
   * name of the app - used to generate cache key
   */
  appName: string;
  /**
   * function to generate cache key from a request
   */
  cacheKeyGen?: KeyGenFn;
  /**
   * options for cache-manager
   */
  cacheOptions: StalierCacheManagerOptions | StalierCacheManagerOptions[];
  /**
   * if true, stalier cache will be global and shared across all modules
   */
  isGlobal?: boolean;
}
