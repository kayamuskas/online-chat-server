import { SERVICE_PORTS } from '@chat/shared';
import { createSystemWorker } from './system.worker.js';

/**
 * Worker process entrypoint.
 *
 * Starts the BullMQ system worker and registers graceful shutdown handlers.
 * This process is intentionally separate from the Nest API so Compose can
 * run it independently and scale it without affecting the HTTP surface.
 */
const redisHost = process.env['REDIS_HOST'] ?? 'localhost';
const redisPort = parseInt(
  process.env['REDIS_PORT'] ?? String(SERVICE_PORTS.redis),
  10,
);

console.log(
  `[worker] starting system worker — Redis ${redisHost}:${redisPort}`,
);

const worker = createSystemWorker(redisHost, redisPort);

// Graceful shutdown: let in-flight jobs finish before exiting.
async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] received ${signal}, closing worker...`);
  await worker.close();
  console.log('[worker] worker closed, exiting');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
