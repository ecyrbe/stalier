import { applyDecorators, UseInterceptors, SetMetadata } from '@nestjs/common';
import { Request } from 'express';
import { STALIER_CACHE_KEY_GEN } from './stalier.constants';
import { StalierInterceptor } from './stalier.interceptor';

export const UseStalierInterceptor = () => UseInterceptors(StalierInterceptor);

export const UseCacheKeyGen = (keyGen: (req: Request) => string) => SetMetadata(STALIER_CACHE_KEY_GEN, keyGen);
