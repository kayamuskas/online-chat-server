import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { QUEUE_NAMES, SYSTEM_JOB_NAMES, redisConnectionOptions } from '@chat/shared';

/**
 * Echo job processor.
 *
 * Exported so unit tests can call it directly without spinning up a Worker.
 * Phase 1 only — this processor validates the queue substrate wiring and
 * returns a deterministic result that smoke scripts can observe.
 */
export async function echoProcessor(
  job: Job,
): Promise<{ ok: boolean; name: string }> {
  console.log(
    `[system-worker] processing job id=${job.id} name=${job.name}`,
    job.data,
  );

  if (job.name !== SYSTEM_JOB_NAMES.echo) {
    throw new Error(`system worker: unexpected job name "${job.name}"`);
  }

  return { ok: true, name: job.name };
}

/**
 * createSystemWorker — factory function exported for testability.
 *
 * SECURITY NOTE (T-01-08): The connection must use `maxRetriesPerRequest: null`
 * so blocking calls work correctly. This is enforced via `redisConnectionOptions`
 * from @chat/shared which always sets that flag.
 */
export function createSystemWorker(redisHost: string, redisPort: number): Worker {
  const worker = new Worker(
    QUEUE_NAMES.system,
    echoProcessor,
    { connection: redisConnectionOptions(redisHost, redisPort) },
  );

  worker.on('completed', (job) => {
    console.log(`[system-worker] completed job id=${job.id} name=${job.name}`);
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[system-worker] failed job id=${job?.id} name=${job?.name}`,
      err,
    );
  });

  return worker;
}
