import { Request } from 'express';

export type KeyGenFn = (req: Request) => string;
