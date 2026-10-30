import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { CrashFilter, initCrashReporting } from './common/crash.filter';

initCrashReporting();

const PROD = process.env.NODE_ENV === 'production';

/** Refuses to start in production with settings that are only safe on a laptop. */
function checkProductionConfig() {
  if (!PROD) return;
  const problems = [
    (process.env.JWT_SECRET ?? '').length < 32 || process.env.JWT_SECRET === 'dev-secret-change-me' ? 'JWT_SECRET must be a random string of 32+ characters' : '',
    !process.env.CORS_ORIGINS ? 'CORS_ORIGINS must list the admin panel URL(s), e.g. https://admin.example.com' : '',
    (process.env.OTP_MODE ?? 'dev') === 'dev' ? 'OTP_MODE must be msg91 (dev mode lets anyone sign in with a fixed code)' : '',
  ].filter(Boolean);
  if (problems.length) throw new Error(`Unsafe production settings:\n - ${problems.join('\n - ')}`);
}

async function bootstrap() {
  checkProductionConfig();
  // The phone app does not need CORS; only the admin panel's web address(es) may call the API from a browser.
  const origins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  const app = await NestFactory.create(AppModule, { cors: origins?.length ? { origin: origins } : true });
  // Behind a reverse proxy (Caddy / load balancer): use the client's real IP for rate limits.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new CrashFilter(app.get(HttpAdapterHost).httpAdapter));
  const doc = new DocumentBuilder()
    .setTitle('Sugar Saathi API')
    .setDescription('Mobile app sync, dietitian admin panel and notifications.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  // API docs are for developers; hidden in production unless API_DOCS=on.
  if (!PROD || process.env.API_DOCS === 'on') SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`Sugar Saathi API on http://localhost:${port} (docs: /docs)`);
}
bootstrap();
