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
  const isDev = process.env.NODE_ENV === 'development';
  let app;

  if (!isDev) {
    // HTTPS options for production
    const httpsOptions = {
      key: fs.readFileSync('/etc/ssl/certs/backend.ovisfing.tech.key'),
      cert: fs.readFileSync('/etc/ssl/certs/backend_ovisfing_tech.crt'),
      ca: fs.readFileSync('/etc/ssl/certs/backend_ovisfing_tech.ca-bundle'),
    };

    app = await NestFactory.create(AppModule, { httpsOptions });
    console.log('Starting in HTTPS mode...');
  } else {
    // HTTP for development
    app = await NestFactory.create(AppModule);
    console.log('Starting in HTTP mode...');
  }

  const reflector = app.get(Reflector);

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalGuards(new AuthGuard(reflector));

  app.enableCors({
    allowedHeaders: '*',
    origin: '*',
    credentials: true,
    methods: '*',
  });

  const port = isDev ? 3000 : 443;
  await app.listen(port, () => {
    console.log(`Application is running on ${isDev ? 'http' : 'https'}://localhost:${port}`);
  });
}

bootstrapApp();
