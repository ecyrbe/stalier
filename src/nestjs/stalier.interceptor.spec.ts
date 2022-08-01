import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Cache } from 'cache-manager';
import request from 'supertest';
import { STALIER_HEADER_KEY } from '../common/constants';
import { STALIER_CACHE_MANAGER } from './stalier.constants';
import { UseStalierInterceptor, UseCacheKeyGen } from './stalier.decorators';
import { StalierModule } from './stalier.module';

// declare a fake controller to test the interceptor
@UseStalierInterceptor()
@Controller()
class TestController {
  @Get('/string')
  getString() {
    return 'hello';
  }

  @Get('/object')
  getObject() {
    return { hello: 'world' };
  }

  @UseCacheKeyGen(() => 'test')
  @Get('/custom-key')
  getCustomKey() {
    return 'hello';
  }

  @Get('/error')
  getError() {
    throw new Error('backend error');
  }
}

const fakeCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  reset: jest.fn(),
};

describe('StalierInterceptor', () => {
  let app: INestApplication;
  let controller: TestController;
  let cache: Cache;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        StalierModule.forRootAsync({
          useFactory: () => ({
            appName: 'test',
            cacheOptions: {
              store: 'memory',
              max: 10000,
            },
          }),
          inject: [],
        }),
      ],
      controllers: [TestController],
    })
      .overrideProvider(STALIER_CACHE_MANAGER)
      .useValue(fakeCache)
      .compile();

    app = module.createNestApplication();
    await app.init();

    controller = module.get(TestController);
    cache = module.get<Cache>(STALIER_CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
    cache.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return hello with no maxAge and no staleWileRevalidate', async () => {
    const response = await request(app.getHttpServer()).get('/string');
    expect(response.statusCode).toBe(200);
    expect(response.text).toBe('hello');
    expect(response.headers['content-type']).toMatch('text/html');
    expect(response.headers['x-cache-status']).toBeUndefined();
    expect(fakeCache.get).toHaveBeenCalledTimes(0);
    expect(fakeCache.set).toHaveBeenCalledTimes(0);
  });

  it('should return object with no maxAge and no staleWileRevalidate', async () => {
    const response = await request(app.getHttpServer()).get('/object');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ hello: 'world' });
    expect(response.headers['content-type']).toMatch('application/json');
    expect(response.headers['x-cache-status']).toBeUndefined();
    expect(fakeCache.get).toHaveBeenCalledTimes(0);
    expect(fakeCache.set).toHaveBeenCalledTimes(0);
  });

  it('should return hello with maxAge=0 and no staleWileRevalidate', async () => {
    const result = await request(app.getHttpServer()).get('/string').set(STALIER_HEADER_KEY, 's-maxage=0');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('NO_CACHE');
    expect(result.text).toBe('hello');
  });

  it('should return object with maxAge=0 and no staleWileRevalidate', async () => {
    const result = await request(app.getHttpServer()).get('/object').set(STALIER_HEADER_KEY, 's-maxage=0');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toEqual('NO_CACHE');
    expect(result.body).toEqual({ hello: 'world' });
  });

  it('should return hello with maxAge=0 and staleWileRevalidate=0', async () => {
    const result = await request(app.getHttpServer())
      .get('/string')
      .set(STALIER_HEADER_KEY, 's-maxage=0, stale-while-revalidate=0');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('NO_CACHE');
    expect(result.text).toBe('hello');
  });

  it('should return object with maxAge=0 and staleWileRevalidate=0', async () => {
    const result = await request(app.getHttpServer())
      .get('/object')
      .set(STALIER_HEADER_KEY, 's-maxage=0, stale-while-revalidate=0');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toEqual('NO_CACHE');
    expect(result.body).toEqual({ hello: 'world' });
  });

  it('should not cache with invalid header', async () => {
    const result = await request(app.getHttpServer())
      .get('/object')
      .set(STALIER_HEADER_KEY, 'maxage=1, stale-revalidate=1');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toEqual('NO_CACHE');
    expect(result.body).toEqual({ hello: 'world' });
    expect(fakeCache.set).not.toHaveBeenCalled();
  });

  it('should not cache errors', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 2000,
      value: 'cachedValue',
    });
    const result = await request(app.getHttpServer())
      .get('/error')
      .set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(500);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toBeUndefined();
    expect(fakeCache.set).not.toHaveBeenCalled();
    expect(result.body).toEqual({ message: 'Internal server error', statusCode: 500 });
  });

  it('should return cachedValue with maxAge=1', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 500,
      value: 'cachedValue',
    });
    const result = await request(app.getHttpServer())
      .get('/string')
      .set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=0');
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
      value: { hello: 'cachedValue' },
    }));

    const req = request(app.getHttpServer());
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
      value: { hello: count },
    }));

    const req = request(app.getHttpServer());
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
      value: 'cachedValue',
    });
    const promise = new Promise<any>(resolve => {
      fakeCache.set.mockImplementation(async (...args) => {
        resolve(args);
      });
    });
    const result = await request(app.getHttpServer())
      .get('/string')
      .set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=0');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('MISS');
    expect(result.text).toBe('hello');
    const resultSet = await promise;
    expect(resultSet).toEqual([
      'test-GET-string',
      {
        lastUpdated: expect.anything(),
        updatedCount: 1,
        value: 'hello',
      },
    ]);
  });

  it('should return staled cachedValue with maxAge=1 and stale-while-revalidate=1', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 1001,
      value: 'cachedValue',
    });
    const promise = new Promise<any>(resolve => {
      fakeCache.set.mockImplementation(async (...args) => {
        resolve(args);
      });
    });

    const result = await request(app.getHttpServer())
      .get('/string')
      .set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('STALE');
    expect(result.text).toBe('cachedValue');
    const resultSet = await promise;
    expect(resultSet).toEqual([
      'test-GET-string',
      {
        lastUpdated: expect.anything(),
        updatedCount: 1,
        value: 'hello',
      },
    ]);
  });

  it('should return staled cachedValue with maxAge=1 and stale-while-revalidate=1 and custom key gen', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 1001,
      value: 'cachedValue',
    });
    const promise = new Promise<any>(resolve => {
      fakeCache.set.mockImplementation(async (...args) => {
        resolve(args);
      });
    });

    const result = await request(app.getHttpServer())
      .get('/custom-key')
      .set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('STALE');
    expect(result.text).toBe('cachedValue');
    const resultSet = await promise;
    expect(resultSet).toEqual([
      'test-test',
      {
        lastUpdated: expect.anything(),
        updatedCount: 1,
        value: 'hello',
      },
    ]);
  });

  it('should return staled cachedValue object with maxAge=1 and stale-while-revalidate=1', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 1001,
      value: { hello: 'cachedValue' },
    });
    const promise = new Promise<any>(resolve => {
      fakeCache.set.mockImplementation(async (...args) => {
        resolve(args);
      });
    });

    const result = await request(app.getHttpServer())
      .get('/object')
      .set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toEqual('STALE');
    expect(result.body).toEqual({ hello: 'cachedValue' });
    const resultSet = await promise;
    expect(resultSet).toEqual([
      'test-GET-object',
      {
        lastUpdated: expect.anything(),
        updatedCount: 1,
        value: { hello: 'world' },
      },
    ]);
  });

  it('should return missed hello with maxAge=1 and stale-while-revalidate=1 with outdated cache', async () => {
    fakeCache.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 2001,
      value: 'cachedValue',
    });
    const promise = new Promise<any>(resolve => {
      fakeCache.set.mockImplementation(async (...args) => {
        resolve(args);
      });
    });

    const result = await request(app.getHttpServer())
      .get('/string')
      .set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('text/html');
    expect(result.headers['x-cache-status']).toEqual('MISS');
    expect(result.text).toBe('hello');
    const resultSet = await promise;
    expect(resultSet).toEqual([
      'test-GET-string',
      {
        lastUpdated: expect.anything(),
        updatedCount: 1,
        value: 'hello',
      },
    ]);
  });

  it('should return missed cachedValue with maxAge=1 and stale-while-revalidate=1 with error cache', async () => {
    fakeCache.get.mockImplementation(() => {
      throw new Error('error get');
    });
    fakeCache.set.mockImplementation(() => {
      throw new Error('error set');
    });
    const result = await request(app.getHttpServer())
      .get('/string')
      .set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
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
    const result = await request(app.getHttpServer())
      .get('/object')
      .set(STALIER_HEADER_KEY, 's-maxage=1, stale-while-revalidate=1');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toMatch('application/json');
    expect(result.headers['x-cache-status']).toEqual('MISS');
    expect(result.body).toEqual({ hello: 'world' });
  });
});
