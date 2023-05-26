import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StalierModule } from 'stalier';

@Module({
  imports: [
    StalierModule.forRoot({
      appName: 'nestjs-example',
      isGlobal: true,
      cacheOptions: {
        store: 'memory',
        max: 1000,
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
