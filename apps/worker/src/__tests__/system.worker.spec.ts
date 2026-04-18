/**
 * Task 2 TDD – RED phase
 *
 * Tests for the BullMQ worker bootstrap behavior defined in plan 01-03.
 */

import { Worker } from 'bullmq';
import { QUEUE_NAMES, SYSTEM_JOB_NAMES } from '@chat/shared';

// ────────────────────────────────────────────────────────────────
// Mocks — prevent actual Redis connection during unit tests
// ────────────────────────────────────────────────────────────────
jest.mock('bullmq', () => {
  const mockWorker = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  }));
  return { Worker: mockWorker };
});

// ────────────────────────────────────────────────────────────────
// Test 1: Worker uses correct Redis connection policy (maxRetriesPerRequest: null)
// ────────────────────────────────────────────────────────────────
describe('system worker – Redis connection policy', () => {
  it('Worker is constructed with maxRetriesPerRequest: null', async () => {
    const { createSystemWorker } = await import('../system.worker.js');
    createSystemWorker('localhost', 6379);

    const MockWorker = Worker as jest.MockedClass<typeof Worker>;
    expect(MockWorker).toHaveBeenCalledWith(
      QUEUE_NAMES.system,
      expect.any(Function),
      expect.objectContaining({
        connection: expect.objectContaining({
          maxRetriesPerRequest: null,
        }),
      }),
    );
  });
});

// ────────────────────────────────────────────────────────────────
// Test 2: Fixed echo job resolves successfully
// ────────────────────────────────────────────────────────────────
describe('system worker – echo job processor', () => {
  it('processes the system echo job and returns ok: true with the job name', async () => {
    const { echoProcessor } = await import('../system.worker.js');

    const fakeJob = {
      name: SYSTEM_JOB_NAMES.echo,
      data: { enqueuedAt: '2026-04-18T12:00:00Z' },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await echoProcessor(fakeJob as any);
    expect(result).toEqual({ ok: true, name: SYSTEM_JOB_NAMES.echo });
  });
});

// ────────────────────────────────────────────────────────────────
// Test 3: Worker is isolated from auth, rooms, and messaging modules
// ────────────────────────────────────────────────────────────────
describe('system worker – isolation', () => {
  it('system.worker module does not import auth, rooms, or messaging symbols', async () => {
    // Dynamically read the worker source to check for prohibited imports.
    // This is intentionally a source-level check rather than a runtime check.
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.resolve(import.meta.dirname ?? __dirname, '../system.worker.ts'),
      'utf-8',
    );
    expect(src).not.toMatch(/from ['"].*auth['"]/);
    expect(src).not.toMatch(/from ['"].*room['"]/);
    expect(src).not.toMatch(/from ['"].*message['"]/);
  });
});
