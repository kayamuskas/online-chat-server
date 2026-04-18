/**
 * Task 1 TDD – RED phase
 *
 * Test 4: POST /api/v1/system-jobs/echo enqueues the fixed system echo job
 * without exposing arbitrary queue or job-name input.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@chat/shared';
import { SystemJobsController } from '../queue/system-jobs.controller.js';

describe('SystemJobsController', () => {
  let controller: SystemJobsController;
  const mockAdd = jest.fn().mockResolvedValue({ id: 'mock-job-id' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemJobsController],
      providers: [
        {
          provide: getQueueToken(QUEUE_NAMES.system),
          useValue: { add: mockAdd },
        },
      ],
    }).compile();

    controller = module.get<SystemJobsController>(SystemJobsController);
    mockAdd.mockClear();
  });

  it('POST /api/v1/system-jobs/echo returns enqueued: true with fixed queue and jobName', async () => {
    const result = await controller.enqueueEcho();
    expect(result).toEqual({ enqueued: true, queue: 'system', jobName: 'echo' });
  });

  it('echo enqueue always uses the fixed SYSTEM_JOB_NAMES.echo job name', async () => {
    await controller.enqueueEcho();
    expect(mockAdd).toHaveBeenCalledWith('echo', expect.anything());
  });

  it('echo endpoint does NOT accept arbitrary queue or job-name parameters', () => {
    // The method signature must have zero parameters
    expect(controller.enqueueEcho.length).toBe(0);
  });
});
