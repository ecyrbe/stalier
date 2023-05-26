import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  async waitfor(seconds: number) {
    return new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, seconds * 1000);
    });
  }

  async getHello() {
    await this.waitfor(5);

    return {
      hello: 'world',
    };
  }
}
