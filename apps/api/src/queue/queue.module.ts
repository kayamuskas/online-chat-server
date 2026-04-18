import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@chat/shared';
import { SystemJobsController } from './system-jobs.controller.js';

/**
 * QueueModule — registers BullMQ queues for the API.
 *
 * The Redis connection is left to the root BullModule.forRoot() configuration
 * registered in AppModule. This module only declares which queue names are
 * available as injectable Queue instances inside the API process.
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_NAMES.system,
    }),
  ],
  controllers: [SystemJobsController],
})
export class QueueModule {}
