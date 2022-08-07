 <p align="center">
   <a href="https://github.com/ecyrbe/stalier">
     <img align="center" src="https://raw.githubusercontent.com/ecyrbe/stalier/main/docs/logo.png" width="256px" alt="Stalier logo">
   </a>
 </p>
 <p align="center">
    Stalier is a stale-while-revalidate middleware for your backend
 </p>
 
 <p align="center">
   <a href="https://www.npmjs.com/package/stalier">
   <img src="https://img.shields.io/npm/v/stalier.svg" alt="langue typescript">
   </a>
   <a href="https://www.npmjs.com/package/stalier">
   <img alt="npm" src="https://img.shields.io/npm/dw/stalier">
   </a>
   <a href="https://github.com/ecyrbe/stalier/blob/main/LICENSE">
    <img alt="GitHub" src="https://img.shields.io/github/license/ecyrbe/stalier">   
   </a>
   <img alt="GitHub Workflow Status" src="https://img.shields.io/github/workflow/status/ecyrbe/stalier/CI">
 </p>

Stalier is cache strategy middleware controled by your frontend by using `x-stalier-cache-control` header.  
This means that instead of your backend sending `Cache-Control` header to your browser for your browser to cache the returned data, your frontend will send the header `X-Stalier-Cache-Control` to your backend for it to cache the returned data from your source of truth.
  
- It is an advanced middleware with support for stale-while-revalidate strategy.  
- Stalier will act as a proxy that caches the response if it sees a `X-Stalier-Cache-Control` header.  
- Since it's embedded in your backend, it's much more efficient than using a separate proxy.  
- It implements part of RFC7234 and RFC5861 but on the backend. It does not use `cache-control` since the cache is controlled by the frontend.
- If you want both your browser and backend to cache the responses, you can use `x-stalier-cache-control` for requests and `cache-control` for responses at the same time.
  
**Table of contents**  
- [Install](#install)
- [Usage : backend](#usage--backend)
  - [Express](#express)
    - [Stalier Options](#stalier-options)
    - [Handle per user caching](#handle-per-user-caching)
  - [NestJS](#nestjs)
    - [Create a Cache instance for StalierInterceptor](#create-a-cache-instance-for-stalierinterceptor)
    - [Options for StalierModule](#options-for-staliermodule)
    - [StalierInterceptor](#stalierinterceptor)
- [Usage : frontend](#usage--frontend)
  - [Example](#example)

## Install

```bash
npm install stalier
```

or

```bash
yarn add stalier
```
## Usage : backend

### Express

Stalier do not provide a cache on it's own, nor does it provide a logger. But you provide them both in the constructor.

```js
import express from 'express';
import cacheManager from 'cache-manager';
import redisStore from 'cache-manager-ioredis';

import { stalier } from 'stalier';

const redisCache = cacheManager.caching({ store: redisStore });

// Create a new express app
const app = express();
// add stalier middleware
app.use(stalier({ appName: 'test', cacheClient: redisCache }));
```

#### Stalier Options

```typescript
type StalierMiddlewareOptions = {
  /**
   * name of the upstream application
   */
  appName: string;
  /**
   * client to use for caching
   * should have an async `get` method and `set` method
   */
  cacheClient: CacheClient;
  /**
   * function to generate a cache key per request
   * Use a custom one to handle per user caching
   * @default `<appName>-<HTTP Verb>-<path>`
   */
  cacheKeyGen?: (req: Request) => string;
  /**
   * logger to use for logging
   * should have a log, warn and error method that takes a message parameter
   * @default `console`
   */
  logger?: Logger;
};
```

#### Handle per user caching

```js
import express from 'express';
import cacheManager from 'cache-manager';
import redisStore from 'cache-manager-ioredis';
import jsonwebtoken from 'jsonwebtoken';
import { stalier } from 'stalier';

// your user middleware
import { userMiddleware } from './userMiddleware';

const redisCache = cacheManager.caching({ store: redisStore });

const appName = 'test';
// cache key per user request that extracts the user email from your user middleware
const cacheKeyGen = (req: Request) => {
  if(req.user) {
    return `${appName}-${req.method}-${req.path}-${req.user.id}`;
  }
  return `${appName}-${req.method}-${req.path}`;
}

app.use(userMiddleware);
app.use(stalier({
  appName,
  cacheClient: redisCache,
  cacheKeyGen,
}));
```

### NestJS

Stalier uses the `NestJsInterceptor` to intercept the request and response, and uses the Cache Module to cache the response.

#### Create a Cache instance for StalierInterceptor

Stalier module allows you to instanciate a Cache with the `cache-manager` library. The cacheOptions can take a single option or an array of options to use multicache strategy from `cache-manager`.
Stalier module as two ways of instanciating a cache:
- `forRoot` - with options known at compile time
- `forRootAsync` - with options known at runtime, usually loaded from a config service
  
As the name suggests, your should only load Stalier module once in your application.
  
```typescript
import { Controller, Get } from '@nestjs/common';
import { UseStalierInterceptor, StalierModule, UseCacheKeyGen } from 'stalier';

import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StalierModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        appName: 'test',
        cacheOptions: configService.get('CACHE_OPTIONS'),
        isGlobal: true,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [MyAppController],
})
```

#### Options for StalierModule

```typescript

interface StalierModuleOptions {
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
interface StalierCacheManagerOptions {
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
```

#### StalierInterceptor

You can load StalierInterceptor Globally (see useGlobalInterceptors) or per Controller (see useInterceptors).

```typescript
@UseStalierInterceptor()
@Controller()
class MyAppController {
  @Get('/default-key')
  getDefaultKey() {
    return { hello: 'world' };
  }

  // per user caching
  @CacheKeyUser((req) => req.user.id)
  @Get('/custom-key')
  getCustomKey() {
    return { hello: 'world' };
  }
}
```

By default, stalier interceptor will use the request path as the cache key.  
To handle per user caching, you can use the `CacheKeyUser` decorator. You can apply it per controller or per method.  
To apply a static key, use the `CacheKey` decorator. Or to have fine grained control, you can use the `CacheKeyGen` decorator.
## Usage : frontend

Stalier is using the `x-stalier-cache-control` header to control the cache behaviour within your frontend.
it supports the following params:

- s-maxage: time in seconds indicating the maximum time the response should be cached. A value of 0 means no caching.
- stale-while-revalidate: time in seconds indicating the time the response should be cached while revalidating. A value of 0 means no window for revalidation and only use cached content.

### Example

If you want a content to be cached for 10 seconds and have a revalidation window of 50 seconds, you can use the following headers:

```http
GET /content HTTP/1.1
x-stalier-cache-control: s-maxage=10, stale-while-revalidate=50
```

if it's not present, it will be cached for 10 seconds, and get back the fresh content with the following headers:

```http
HTTP/1.1 200 OK
x-cache-status: MISS
```

Requesting another time the same content within 10 seconds will return the cached content with the following headers:

```http
HTTP/1.1 200 OK
x-cache-status: HIT
```

Requesting another time the same content within 50 seconds will return the cached content and try to refresh the cache in the background and return following headers:

```http
HTTP/1.1 200 OK
x-cache-status: STALE
```

Another call will then return the refreshed content with the following headers:

```http
HTTP/1.1 200 OK
x-cache-status: HIT
```
