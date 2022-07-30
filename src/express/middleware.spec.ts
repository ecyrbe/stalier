import express from 'express';
import request from 'supertest';
import { stalier } from './middleware';
import { STALIER_HEADER_KEY } from '../common/constants';

const fakeCache = {
  get: jest.fn(),
  set: jest.fn(),
};

const errorInterceptor: express.ErrorRequestHandler = (err, req, res, next) => {
  return res.status(500).json({ error: err.message });
};

describe('stalier-express', () => {
  // setup a server with stalier middleware
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(stalier({ appName: 'test', cacheClient: fakeCache }));
    app.get('/string', async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 100)));
      res.send('hello');
    });
    app.get('/object', async (req, res) => {
      await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 100)));
      res.json({ hello: 'world' });
    });
    app.get('/error', async (req, res, next) => {
      next(new Error('backend error'));
    });
    app.use(errorInterceptor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should exist', () => {
    expect(stalier).toBeDefined();
  });

  it('should return hello with no maxAge and no staleWileRevalidate', async () => {
    const result = await request(app).get('/string');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toBeUndefined();
    expect(result.text).toBe('hello');
  });
  it('should return object with no maxAge and no staleWileRevalidate', async () => {
    const result = await request(app).get('/object');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toBeUndefined();
    expect(result.body).toEqual({ hello: 'world' });
  });

  it('should return hello with maxAge=0 and no staleWileRevalidate', async () => {
    const result = await request(app).get('/string').set(STALIER_HEADER_KEY, 's-maxage=0');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('NO_CACHE');
    expect(result.text).toBe('hello');
  });

  it('should return object with maxAge=0 and no staleWileRevalidate', async () => {
    const result = await request(app).get('/object').set(STALIER_HEADER_KEY, 's-maxage=0');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toEqual('NO_CACHE');
    expect(result.body).toEqual({ hello: 'world' });
  });

  it('should return hello with maxAge=0 and staleWileRevalidate=0', async () => {
    const result = await request(app).get('/string').set(STALIER_HEADER_KEY, 's-maxage=0, stale-while-revalidate=0');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('NO_CACHE');
    expect(result.text).toBe('hello');
  });

  it('should return object with maxAge=0 and staleWileRevalidate=0', async () => {
    const result = await request(app).get('/object').set(STALIER_HEADER_KEY, 's-maxage=0, stale-while-revalidate=0');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toEqual('NO_CACHE');
    expect(result.body).toEqual({ hello: 'world' });
  });

  it('should not cache errors', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 2000,
      value: {
        data: 'cachedValue',
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
      },
    });
    const result = await request(app).get('/error').set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(500);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toEqual('NO_CACHE');
    expect(fakeCache.set).not.toHaveBeenCalled();
    expect(result.body).toEqual({ error: 'backend error' });
  });

  it('should return cachedValue with maxAge=1', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 500,
      value: {
        data: 'cachedValue',
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
      },
    });

    const result = await request(app).get('/string').set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=0');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('HIT');
    expect(result.text).toBe('cachedValue');
  });

  it('should return cachedValue object with maxAge=1', async () => {
    let count = 0;
    fakeCache.get.mockImplementation(() => ({
      updatedCount: count++,
      lastUpdated: Date.now() - 500,
      value: {
        data: JSON.stringify({ hello: 'cachedValue' }),
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
      },
    }));

    const req = request(app);
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(req.get('/object').set(STALIER_HEADER_KEY, `s-maxage=1, stale-while-revalidate=0`));
    }
    const results = await Promise.all(promises);
    expect(results.length).toBe(10);
    expect(fakeCache.get().updatedCount).toBe(10);
    results.forEach(result => {
      expect(result.statusCode).toBe(200);
      expect(result.headers['content-type']).toMatch('application/json');
      expect(result.headers['x-cache-status']).toEqual('HIT');
      expect(result.body).toEqual({ hello: 'cachedValue' });
    });
  });

  it('should return cachedValue object with maxAge=1 and stale-while-revalidate=1', async () => {
    let count = 0;
    fakeCache.get.mockImplementation(() => ({
      updatedCount: count++,
      lastUpdated: Date.now() - 1001,
      value: {
        data: JSON.stringify({ hello: count }),
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
      },
    }));

    const req = request(app);
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(req.get('/object').set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1'));
    }
    const results = await Promise.all(promises);
    expect(results.length).toBe(10);
    expect(fakeCache.get().updatedCount).toBe(10);
    let sum = 0;
    results.forEach(result => {
      expect(result.statusCode).toBe(200);
      expect(result.headers['content-type']).toMatch('application/json');
      expect(result.headers['x-cache-status']).toEqual('STALE');
      sum += result.body.hello;
    });
    expect(sum).toBe(55);
  });

  it('should return hello with maxAge=1 and outdated cache', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 1001,
      value: {
        data: 'cachedValue',
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
      },
    });

    const result = await request(app).get('/string').set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=0');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('MISS');
    expect(result.text).toBe('hello');
  });

  it('should return staled cachedValue with maxAge=1 and stale-while-revalidate=1', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 1001,
      value: {
        data: 'cachedValue',
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
      },
    });

    const result = await request(app).get('/string').set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('STALE');
    expect(result.text).toBe('cachedValue');
  });

  it('should return staled cachedValue object with maxAge=1 and stale-while-revalidate=1', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 1001,
      value: {
        data: JSON.stringify({ hello: 'cachedValue' }),
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
      },
    });

    const result = await request(app).get('/object').set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toEqual('STALE');
    expect(result.body).toEqual({ hello: 'cachedValue' });
  });

  it('should return missed hello with maxAge=1 and stale-while-revalidate=1 with outdated cache', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 2001,
      value: {
        data: 'cachedValue',
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
      },
    });

    const result = await request(app).get('/string').set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('MISS');
    expect(result.text).toBe('hello');
  });

  it('should return missed cachedValue with maxAge=1 and stale-while-revalidate=1 with error cache', async () => {
    fakeCache.get.mockImplementation(() => {
      throw new Error('error get');
    });
    fakeCache.set.mockImplementation(() => {
      throw new Error('error set');
    });
    const result = await request(app).get('/string').set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('MISS');
    expect(result.text).toBe('hello');
  });

  it('should return missed cachedValue object with maxAge=1 and stale-while-revalidate=1 with error cache', async () => {
    fakeCache.get.mockImplementation(() => {
      throw new Error('error get');
    });
    fakeCache.set.mockImplementation(() => {
      throw new Error('error set');
    });
    const result = await request(app).get('/object').set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toEqual('MISS');
    expect(result.body).toEqual({ hello: 'world' });
  });
});
