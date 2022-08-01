import { CacheStore, CacheStoreFactory } from '@nestjs/common';
import { KeyGenFn } from '../common/types';

export interface StalierCacheManagerOptions {
  store: 'memory' | 'none' | CacheStore | CacheStoreFactory;
  max?: number;
  ttl?: number;
}

export interface StalierModuleOptions {
  appName: string;
  cacheKeyGen?: KeyGenFn;
  cacheOptions: StalierCacheManagerOptions | StalierCacheManagerOptions[];
  isGlobal?: boolean;
}
