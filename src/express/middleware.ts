import type { RequestHandler, Request } from 'express';
import type { OutgoingHttpHeaders } from 'http';
import { withStaleWhileRevalidate } from '../stalier';
import { StalierOptions } from '../stalier.types';

export const STALIER_HEADER_KEY = 'X-Stalier-Cache-Control';

const MATCH_HEADER = /s-maxage=([0-9]+)(\s*,\s*(stale-while-revalidate=([0-9]+)))?/;

export type StalierMiddlewareOptions = {
  /**
   * name of the upstream application
   */
  appName: string;
  /**
   * client to use for caching
   */
  cacheClient: StalierOptions['cacheClient'];
  /**
   * function to generate a cache key per request
   * Use a custom one to handle per user caching
   * @default `<appName>-<HTTP Verb>-<path>`
   */
  cacheKeyGen?: (req: Request) => string;
  /**
   * logger to use for logging
   * @default `console`
   */
  logger?: StalierOptions['logger'];
};

/**
 * default cache key generator
 */
const defaultKeyGenerator = (name: string) => (req: Request) => {
  return `${name}-${req.method}-${req.originalUrl}`;
};

/**
 * middleware to cache responses
 * @param options - options for stalier
 */
export const stalier: (options: StalierMiddlewareOptions) => RequestHandler = options => (req, res, next) => {
  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    return next();
  }
  const { cacheClient, cacheKeyGen = defaultKeyGenerator(options.appName), logger = console } = options;
  const cacheControl = req.get(STALIER_HEADER_KEY);
  if (cacheControl) {
    const matched = cacheControl.match(MATCH_HEADER);
    if (matched) {
      const maxAge = parseInt(matched[1]);
      const staleWhileRevalidate = matched[4] ? parseInt(matched[4]) : 0;
      const send = res.send.bind(res);
      const freshResult = new Promise<{ data: Buffer | string; statusCode: number; headers: OutgoingHttpHeaders }>(
        (resolve, reject) => {
          res.send = function (data) {
            if (this.statusCode >= 200 && this.statusCode <= 300) {
              resolve({ data, statusCode: this.statusCode, headers: this.getHeaders() });
            } else {
              reject({ data, statusCode: this.statusCode, headers: this.getHeaders() });
            }
            return this;
          };
        },
      );
      const result = withStaleWhileRevalidate(
        () => {
          next();
          return freshResult;
        },
        {
          maxAge,
          staleWhileRevalidate,
          cacheKey: cacheKeyGen(req),
          cacheClient,
          logger,
        },
      );
      return result
        .then(({ data, status }) => {
          res.status(data.statusCode);
          if (data.headers) {
            res.set(data.headers);
          }
          res.set('X-Cache-Status', status);
          send(data.data);
        })
        .catch(reason => {
          if (reason.data && reason.statusCode) {
            res.status(reason.statusCode);
            if (reason.headers) {
              res.set(reason.headers);
            }
            res.set('X-Cache-Status', 'NO_CACHE');
            send(reason.data);
          } else {
            res.status(500);
            res.set('X-Cache-Status', 'NO_CACHE');
            send(JSON.stringify({ error: 'unexpected error while processing cache' }));
          }
        });
    }
  }
  res.set('X-Cache-Status', 'NO_CACHE');
  next();
};
