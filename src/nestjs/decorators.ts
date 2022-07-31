import { applyDecorators, UseInterceptors, SetMetadata } from '@nestjs/common';
import { Request } from 'express';
import { STALIER_APP_NAME, STALIER_CACHE_KEY_GEN } from '../common/constants';
import { StalierInterceptor } from './interceptor';

export const UseStalierInterceptor = (options: { appName: string; cacheKeyGen?: (req: Request) => string }) =>
  applyDecorators(
    SetMetadata(STALIER_APP_NAME, options.appName),
    SetMetadata(STALIER_CACHE_KEY_GEN, options.cacheKeyGen),
    UseInterceptors(StalierInterceptor),
  );

export const UseCacheKeyGen = (keyGen: (req: Request) => string) => SetMetadata(STALIER_CACHE_KEY_GEN, keyGen);
