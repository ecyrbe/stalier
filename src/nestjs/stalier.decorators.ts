import { UseInterceptors, SetMetadata } from '@nestjs/common';
import { Request } from 'express';
import { defaultKeyGenerator } from '../common/utils';
import { STALIER_CACHE_KEY_GEN } from './stalier.constants';
import { StalierInterceptor } from './stalier.interceptor';

export const UseStalierInterceptor = () => UseInterceptors(StalierInterceptor);

export const CacheKey = (key: string) => SetMetadata(STALIER_CACHE_KEY_GEN, () => key);
export const CacheKeyGen = (cacheKeyFn: (req: Request) => string) => SetMetadata(STALIER_CACHE_KEY_GEN, cacheKeyFn);
export const CacheKeyUser = (userCacheKeyFn: (req: Request) => string) =>
  SetMetadata(STALIER_CACHE_KEY_GEN, (req: Request) => defaultKeyGenerator(userCacheKeyFn(req))(req));
