// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AddressInfo } from 'node:net';

import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // CORS with explicit allow-list
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAnyOrigin = allowedOrigins.includes('*');

  if (allowAnyOrigin) {
    console.warn(
      'ALLOWED_ORIGINS contains "*". For better security, remove wildcard when credentials=true.',
    );
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests without browser origin (mobile app, curl, Postman)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowAnyOrigin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('HealthQuest API')
    .setDescription('HealthQuest API routes')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = Number(process.env.PORT || 3000);

  try {
    await app.listen(port);
  } catch (error: any) {
    if (error?.code === 'EADDRINUSE') {
      console.error(
        `Port ${port} is already in use. Stop the existing process or run with another port, for example: PORT=3001 npm run start:dev`,
      );
      process.exit(1);
    }

    throw error;
  }

  const address = app.getHttpServer().address() as AddressInfo;
  const runningPort = address?.port ?? port;

  console.log(`Clinical Service running at: http://localhost:${runningPort}`);
  console.log(`Swagger docs available at: http://localhost:${runningPort}/api`);
}
bootstrap();
