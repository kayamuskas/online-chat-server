/**
 * Shared queue name registry and job-name contracts.
 *
 * Centralising these constants in @chat/shared prevents later plans from
 * introducing incompatible queue names or Redis connection policies.
 *
 * All BullMQ Queue and Worker instances that process these queues MUST connect
 * using the same Redis connection options. Workers MUST set
 * `maxRetriesPerRequest: null` on the connection object so blocking calls work
 * correctly.
 */

export const QUEUE_NAMES = {
  /** System-level jobs used for health checks and internal diagnostics. */
  system: "system",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const SYSTEM_JOB_NAMES = {
  /**
   * A trivial echo job used during Phase 1 to verify that the queue substrate
   * and worker process are wired correctly. Later phases will add domain jobs.
   */
  echo: "echo",
} as const;

export type SystemJobName = (typeof SYSTEM_JOB_NAMES)[keyof typeof SYSTEM_JOB_NAMES];

/**
 * Canonical Redis connection options for BullMQ queues and workers.
 *
 * Usage in Queue producers:
 *   new Queue(QUEUE_NAMES.system, { connection: redisConnectionOptions(...) })
 *
 * Usage in Workers (note: workers require maxRetriesPerRequest: null):
 *   new Worker(QUEUE_NAMES.system, processor, {
 *     connection: redisConnectionOptions(host, port),
 *   })
 *
 * The `maxRetriesPerRequest: null` option is required for BullMQ workers to
 * operate in blocking mode. Omitting it causes the worker to fail on Redis
 * connection retries.
 */
export function redisConnectionOptions(
  host: string,
  port: number,
): {
  host: string;
  port: number;
  maxRetriesPerRequest: null;
} {
  return { host, port, maxRetriesPerRequest: null };
}
