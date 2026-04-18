/**
 * @chat/shared — shared runtime contracts for the online-chat-server monorepo.
 *
 * Import from this package in apps/api, apps/worker, and apps/web to get
 * stable port definitions, runtime environment types, queue name constants,
 * and BullMQ connection helpers.
 */

export {
  SERVICE_PORTS,
  parseRuntimeEnv,
  type RuntimeEnv,
} from "./config.js";

export {
  QUEUE_NAMES,
  SYSTEM_JOB_NAMES,
  redisConnectionOptions,
  type QueueName,
  type SystemJobName,
} from "./queue.js";
