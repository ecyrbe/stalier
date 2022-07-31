import { CACHE_MANAGER, CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { lastValueFrom, of } from 'rxjs';
import { Cache } from 'cache-manager';
import { withStaleWhileRevalidate } from '../stalier';
import { MATCH_HEADER, STALIER_APP_NAME, STALIER_CACHE_KEY_GEN, STALIER_HEADER_KEY } from '../common/constants';
import { defaultKeyGenerator } from '../common/utils';

type KeyGenFn = (req: Request) => string;

@Injectable()
export class StalierInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject('Reflector') private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    if (!['GET', 'POST'].includes(request.method)) {
      return next.handle();
    }
    const cacheControl = request.get(STALIER_HEADER_KEY);
    if (cacheControl) {
      const matched = cacheControl.match(MATCH_HEADER);
      if (matched) {
        const maxAge = parseInt(matched[1]);
        const staleWhileRevalidate = matched[4] ? parseInt(matched[4]) : 0;

        const keyGen = this.getKeyGen(context);
        const result = withStaleWhileRevalidate(() => lastValueFrom(next.handle()), {
          cacheKey: keyGen(request),
          cacheClient: this.cacheManager,
          maxAge,
          staleWhileRevalidate,
        });
        return result.then(result => {
          response.set('X-Cache-Status', result.status);
          return of(result.data);
        });
      }
      response.set('X-Cache-Status', 'NO_CACHE');
    }
    return next.handle();
  }

  protected getKeyGen(context: ExecutionContext): KeyGenFn {
    const keyGen =
      this.reflector.get<KeyGenFn>(STALIER_CACHE_KEY_GEN, context.getHandler()) ||
      this.reflector.get<KeyGenFn>(STALIER_CACHE_KEY_GEN, context.getClass());
    const appName =
      this.reflector.get<string>(STALIER_APP_NAME, context.getClass()) ||
      `${context.getClass().name}-${context.getHandler().name}`;
    if (keyGen) {
      return (req: Request) => `${appName}-${keyGen(req)}`;
    }
    return defaultKeyGenerator(appName);
  }
}
