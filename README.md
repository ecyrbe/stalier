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
It is an advanced middleware that can be used to cache your backend responses with support for stale-while-revalidate strategy.  
Stalier will act as a proxy to your routes and cache the response if front-end asks for it.  
Since it's embedded in your backend, it's much more efficient than using a separate proxy.  
It implements part of RFC7234 and RFC5861 but on the backend. It does not use `cache-control` header to not allow the browser to interfere with it.  
If you want both your browser to cache the response the response and if not present cache on the backend, you can use `x-stalier-cache-control` and `cache-control` headers at the same time.

## INSTALL

```bash
npm install stalier
```

or

```bash
yarn add stalier
```

## USAGE

Stalier do not provide a cache on it's own, nor does it provide a logger. But you provide them both in the constructor.

```js
import express from 'express';
import cacheManager from 'cache-manager';
import redisStore from 'cache-manager-ioredis';

import { stalier } from 'stalier';

var redisCache = cacheManager.caching({ store: redisStore });

// Create a new express app
const app = express();
// add stalier middleware
app.use(stalier({ cachePrefix: 'test', cacheClient: redisCache }));
```

## Header `x-stalier-cache-control` params

Stalier is using the `x-stalier-cache-control` header to control the cache behaviour.
it supports the following params:

- s-maxage: time in seconds indicating the maximum time the response should be cached. A value of 0 means no caching.
- stale-while-revalidate: time in seconds indicating the time the response should be cached while revalidating. A value of 0 means no window for revalidation and only use cached content.

## Example

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
