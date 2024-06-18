import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'reflect-metadata';
import 'dotenv/config';
import { bootstrap } from 'global-agent';

// Set the global environment variables for the proxy
process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.HTTP_PROXY;
process.env.GLOBAL_AGENT_HTTPS_PROXY = process.env.HTTPS_PROXY;
process.env.GLOBAL_AGENT_NO_PROXY = process.env.NO_PROXY;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

global['fetch'] = require('node-fetch');
bootstrap();

async function bootstrapApp() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrapApp();
