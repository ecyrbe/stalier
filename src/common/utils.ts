import { Request } from 'express';

/**
 * default cache key generator
 */
export const defaultKeyGenerator = (name: string) => (req: Request) => {
  return `${name}-${req.method}-${req.originalUrl.replace(/[._~:/?#[\]@!$&'()*+,;=]/g, '')}`;
};
