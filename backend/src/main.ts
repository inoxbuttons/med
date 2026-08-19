// GigaChat uses Sber's self-signed certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Разрешённые origins: сайт клиники + локальная разработка.
// Добавляй домены клиник через CORS_ORIGINS="https://a.ru,https://b.ru"
const DEFAULT_ORIGINS = ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1'];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const extraOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOrigins = [...DEFAULT_ORIGINS, ...extraOrigins];

  app.enableCors({
    origin: (origin, cb) => {
      // Запросы без Origin (curl, Postman, server-to-server) — пропускаем
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} не разрешён`));
    },
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();
