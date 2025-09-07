import { Injectable } from '@nestjs/common';
import * as packageJson from '../package.json';

@Injectable()
export class AppService {
  getHello(): any {
    return {
      message: 'Hello World!',
      name: packageJson.name,
      version: packageJson.version,
    };
  }
}
