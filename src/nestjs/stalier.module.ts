import { Module, DynamicModule, Provider, ConfigurableModuleAsyncOptions } from '@nestjs/common';
import { caching, multiCaching, Cache, StoreConfig } from 'cache-manager';
import { STALIER_CACHE_MANAGER, STALIER_OPTIONS } from './stalier.constants';
import { StalierModuleOptions } from './stalier.interfaces';

function createCacheProvider(): Provider {
  return {
    provide: STALIER_CACHE_MANAGER,
    useFactory: (options: StalierModuleOptions) => {
      const cacheOptions = options.cacheOptions;
      if (Array.isArray(cacheOptions)) {
        return multiCaching(cacheOptions.map(o => caching(o as StoreConfig)));
      }
      return caching(cacheOptions as StoreConfig);
    },
    inject: [STALIER_OPTIONS],
  };
}

function createSyncOptionsProvider(options: StalierModuleOptions): Provider {
  return {
    provide: STALIER_OPTIONS,
    useValue: options,
  };
}
function createAsyncOptionsProvider(options: ConfigurableModuleAsyncOptions<StalierModuleOptions>): Provider {
  const useFactory = options.useFactory;
  if (useFactory) {
    return {
      provide: STALIER_OPTIONS,
      useFactory,
      inject: options.inject || [],
    };
  }
  throw new Error('Stalier useFactory is required when using async forRootAsync');
}

@Module({})
export class StalierModule {
  /**
   * create a StalierModule syncronously
   * @param options - StalierModuleOptions
   * @returns - StalierModule
   * @example
   * ```ts
   * {
   *  imports: [
   *   StalierModule.forRoot({
   *    appName: 'my-app',
   *    cacheKeyGen: (key: string) => key,
   *    cacheOptions: {
   *      store: 'memory',
   *      max: 1000,
   *      ttl: 60,
   *    },
   *    isGlobal: true,
   *  }),
   * ],
   * }
   * ```
   */
  static forRoot(options: StalierModuleOptions): DynamicModule {
    const optionsProvider = createSyncOptionsProvider(options);
    const cacheProvider = createCacheProvider();
    return {
      module: StalierModule,
      global: Boolean(options.isGlobal),
      providers: [optionsProvider, cacheProvider],
      exports: [optionsProvider, cacheProvider],
    };
  }
  /**
   * create a StalierModule asyncronously
   * @param options - AsyncStalierModuleOptions
   * @returns - StalierModule
   * @example
   * ```ts
   * {
   * imports: [
   *  StalierModule.forRootAsync({
   *   useFactory: async (configService: ConfigService) => configService.getStalierOptions(),
   *   inject: [ConfigService],
   *  }),
   * ],
   * }
   * ```
   */
  static forRootAsync(
    options: Omit<
      ConfigurableModuleAsyncOptions<StalierModuleOptions>,
      'useExisting' | 'useClass' | 'provideInjectionTokensFrom' | 'imports'
    > & { isGlobal?: boolean },
  ): DynamicModule {
    const optionsProvider = createAsyncOptionsProvider(options);
    const cacheProvider = createCacheProvider();
    return {
      module: StalierModule,
      global: Boolean(options.isGlobal),
      providers: [optionsProvider, cacheProvider],
      exports: [optionsProvider, cacheProvider],
    };
  }
}
