import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { parseRuntimeEnv, SERVICE_PORTS } from '@chat/shared';
import cookieParser from 'cookie-parser';

/**
 * Bootstrap the Nest hybrid REST + WebSocket API.
 *
 * Phase 1 surface:
 *  - GET  /healthz                   → health check (unauthenticated)
 *  - GET  /api/v1/meta               → service metadata
 *  - POST /api/v1/system-jobs/echo   → enqueue fixed system echo job
 *  - WS   /                          → Socket.IO handshake + ping/pong
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = parseRuntimeEnv();
  const allowedOrigins = env.ALLOWED_ORIGIN.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  // Enable cookie parsing so session cookies are available on req.cookies.
  app.use(cookieParser());

  // Restrict credentialed browser access to the configured web origin.
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = parseInt(process.env['API_PORT'] ?? String(SERVICE_PORTS.apiHttp), 10);
  await app.listen(port);

  console.log(`API listening on http://localhost:${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
