import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import 'reflect-metadata';
import 'dotenv/config';
import { bootstrap } from 'global-agent';
import { AuthGuard } from './commons/guards/auth.guard';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';

global['fetch'] = require('node-fetch');
bootstrap();

async function bootstrapApp() {
  const app = await NestFactory.create(AppModule);
  console.log('Starting in HTTP mode...');

  const reflector = app.get(Reflector);

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalGuards(new AuthGuard(reflector));

  app.enableCors({
    allowedHeaders: '*',
    origin: '*',
    credentials: true,
    methods: '*',
  });

  const port = 3000;
  await app.listen(port, () => {
    console.log(`Application is running locahost port ${port}`);
  });
}

bootstrapApp();
