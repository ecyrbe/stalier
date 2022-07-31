import { KeyGenFn } from './types';

/**
 * default cache key generator
 */
export const defaultKeyGenerator =
  (name: string): KeyGenFn =>
  req => {
    return `${name}-${req.method}-${req.originalUrl.replace(/[._~:/?#[\]@!$&'()*+,;=]/g, '')}`;
  };
