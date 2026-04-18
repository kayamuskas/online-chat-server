import { Controller, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, SYSTEM_JOB_NAMES } from '@chat/shared';

interface EchoEnqueueResponse {
  enqueued: boolean;
  queue: string;
  jobName: string;
}

/**
 * SystemJobsController — deterministic enqueue path for Phase 1 queue smoke tests.
 *
 * SECURITY NOTE (T-01-09): Only the fixed echo job can be enqueued through
 * this endpoint. Arbitrary queue names and job names are intentionally not
 * accepted as input parameters so the API cannot be used to inject unexpected
 * jobs into the queue substrate.
 */
@Controller('api/v1/system-jobs')
export class SystemJobsController {
  constructor(
    @InjectQueue(QUEUE_NAMES.system)
    private readonly systemQueue: Queue,
  ) {}

  /**
   * POST /api/v1/system-jobs/echo
   *
   * Enqueues the fixed system echo job. Used by smoke tests in Plan 04 to
   * verify end-to-end queue connectivity without requiring domain behavior.
   */
  @Post('echo')
  async enqueueEcho(): Promise<EchoEnqueueResponse> {
    await this.systemQueue.add(SYSTEM_JOB_NAMES.echo, {
      enqueuedAt: new Date().toISOString(),
    });

    return {
      enqueued: true,
      queue: QUEUE_NAMES.system,
      jobName: SYSTEM_JOB_NAMES.echo,
    };
  }
}
