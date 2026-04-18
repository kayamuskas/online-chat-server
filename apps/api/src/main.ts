import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SERVICE_PORTS } from '@chat/shared';

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

  // Enable CORS for the web client. Phase 2 will constrain this to the
  // configured origin once the frontend URL is stable.
  app.enableCors();

  const port = parseInt(process.env['API_PORT'] ?? String(SERVICE_PORTS.apiHttp), 10);
  await app.listen(port);

  console.log(`API listening on http://localhost:${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
