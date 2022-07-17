import { withStaleWhileRevalidate } from './stalier';

// in memory cache provider
const fakeCacheProvider = {
  get: jest.fn(),
  set: jest.fn(),
};

describe('stalier', () => {
  beforeAll(() => {
    jest.useFakeTimers({ now: Date.now() });
  });
  afterAll(() => {
    jest.useRealTimers();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('should exist', () => {
    expect(withStaleWhileRevalidate).toBeDefined();
  });
  it('should return result of fn with no maxAge and no staleWileRevalidate', async () => {
    const fn = async () => 'result';
    const result = await withStaleWhileRevalidate(fn, { cacheKey: 'cacheKey', cacheClient: fakeCacheProvider });
    expect(result).toStrictEqual({ data: 'result', status: 'NO_CACHE' });
  });
  it('should return result of fn with maxAge and no staleWileRevalidate and nothing is in cache', async () => {
    const fn = async () => 'result';
    const result = await withStaleWhileRevalidate(fn, {
      maxAge: 1,
      cacheKey: 'cacheKey',
      cacheClient: fakeCacheProvider,
    });
    expect(result).toStrictEqual({ data: 'result', status: 'MISS' });
  });
  it('should return result of fn with maxAge and staleWileRevalidate and nothing is in cache', async () => {
    const fn = async () => 'result';
    const result = await withStaleWhileRevalidate(fn, {
      maxAge: 1,
      staleWhileRevalidate: 1,
      cacheKey: 'cacheKey',
      cacheClient: fakeCacheProvider,
    });
    expect(result).toStrictEqual({ data: 'result', status: 'MISS' });
  });
  it('should return cachedvalue with maxAge and staleWileRevalidate and something is in cache', async () => {
    const fn = async () => 'result';
    fakeCacheProvider.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 500,
      value: 'cachedValue',
    });
    const result = await withStaleWhileRevalidate(fn, {
      maxAge: 1,
      staleWhileRevalidate: 1,
      cacheKey: 'cacheKey',
      cacheClient: fakeCacheProvider,
    });
    expect(result).toStrictEqual({ data: 'cachedValue', status: 'HIT' });
    expect(fakeCacheProvider.set).not.toHaveBeenCalled();
  });
  it('should return cachedvalue with function key and with maxAge and staleWileRevalidate and something is in cache', async () => {
    const fn = async () => 'result';
    fakeCacheProvider.get.mockReturnValue({
      updatedCount: 0,
      lastUpdated: Date.now() - 500,
      value: 'cachedValue',
    });
    const result = await withStaleWhileRevalidate(fn, {
      maxAge: 1,
      staleWhileRevalidate: 1,
      cacheKey: () => 'cacheKey',
      cacheClient: fakeCacheProvider,
    });
    expect(result).toStrictEqual({ data: 'cachedValue', status: 'HIT' });
    expect(fakeCacheProvider.set).not.toHaveBeenCalled();
  });

  it('should return stale cachedvalue with maxAge and staleWileRevalidate and something is in cache', async () => {
    const fn = async () => 'result';
    fakeCacheProvider.get.mockReturnValue({
      updatedCount: 2,
      lastUpdated: Date.now() - 1001,
      value: 'cachedValue',
    });
    const result = await withStaleWhileRevalidate(fn, {
      maxAge: 1,
      staleWhileRevalidate: 1,
      cacheKey: 'cacheKey',
      cacheClient: fakeCacheProvider,
    });
    expect(result).toStrictEqual({ data: 'cachedValue', status: 'STALE' });
    expect(fakeCacheProvider.set).toHaveBeenCalledTimes(1);
    expect(fakeCacheProvider.set).toHaveBeenCalledWith('cacheKey', {
      updatedCount: 3,
      lastUpdated: expect.anything(),
      value: 'result',
    });
  });

  it('should return fn with maxAge and staleWileRevalidate expired and something is in cache', async () => {
    const fn = async () => 'result';
    fakeCacheProvider.get.mockReturnValue({
      updatedCount: 1,
      lastUpdated: Date.now() - 2001,
      value: 'cachedValue',
    });
    const result = await withStaleWhileRevalidate(fn, {
      maxAge: 1,
      staleWhileRevalidate: 1,
      cacheKey: 'cacheKey',
      cacheClient: fakeCacheProvider,
    });
    expect(result).toStrictEqual({ data: 'result', status: 'MISS' });
    expect(fakeCacheProvider.set).toHaveBeenCalledTimes(1);
    expect(fakeCacheProvider.set).toHaveBeenCalledWith('cacheKey', {
      updatedCount: 2,
      lastUpdated: expect.anything(),
      value: 'result',
    });
  });

  it('should return cachedValue if setting cache returns an error', async () => {
    const fn = async () => 'result';
    fakeCacheProvider.get.mockReturnValue({
      updatedCount: 1,
      lastUpdated: Date.now() - 1001,
      value: 'cachedValue',
    });
    fakeCacheProvider.set.mockImplementation(() => {
      throw new Error('error');
    });
    const result = await withStaleWhileRevalidate(fn, {
      maxAge: 1,
      staleWhileRevalidate: 1,
      cacheKey: 'cacheKey',
      cacheClient: fakeCacheProvider,
    });
    expect(result).toStrictEqual({ data: 'cachedValue', status: 'STALE' });
  });

  it('should return fn if cache returns an error', async () => {
    const fn = async () => 'result';
    fakeCacheProvider.get.mockImplementation(() => {
      throw new Error('error');
    });
    fakeCacheProvider.set.mockImplementation(() => {
      throw new Error('error');
    });
    const result = await withStaleWhileRevalidate(fn, {
      maxAge: 1,
      staleWhileRevalidate: 1,
      cacheKey: 'cacheKey',
      cacheClient: fakeCacheProvider,
    });
    expect(result).toStrictEqual({ data: 'result', status: 'MISS' });
  });
  it('should return fn if cache returns error not instance of Error', async () => {
    const fn = async () => 'result';
    fakeCacheProvider.get.mockImplementation(() => {
      throw 'error';
    });
    fakeCacheProvider.set.mockImplementation(() => {
      throw 'error';
    });
    const result = await withStaleWhileRevalidate(fn, {
      maxAge: 1,
      staleWhileRevalidate: 1,
      cacheKey: 'cacheKey',
      cacheClient: fakeCacheProvider,
    });
    expect(result).toStrictEqual({ data: 'result', status: 'MISS' });
  });

  it('should return cachedValue if setting cache returns an error not instance of Error', async () => {
    const fn = async () => 'result';
    fakeCacheProvider.get.mockReturnValue({
      updatedCount: 1,
      lastUpdated: Date.now() - 1001,
      value: 'cachedValue',
    });
    fakeCacheProvider.set.mockImplementation(() => {
      throw 'error';
    });
    const result = await withStaleWhileRevalidate(fn, {
      maxAge: 1,
      staleWhileRevalidate: 1,
      cacheKey: 'cacheKey',
      cacheClient: fakeCacheProvider,
    });
    expect(result).toStrictEqual({ data: 'cachedValue', status: 'STALE' });
  });
});
