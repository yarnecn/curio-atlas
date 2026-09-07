import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = (process.env.API_CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',').map((item) => item.trim()).filter(Boolean);
  app.enableCors({
    credentials: true,
    origin: allowedOrigins,
  });
  app.enableShutdownHooks();
  const port = Number.parseInt(process.env.API_PORT ?? '4000', 10);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
