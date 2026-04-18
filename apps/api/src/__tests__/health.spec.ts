/**
 * Task 1 TDD – RED phase
 *
 * Tests for the API surface defined in plan 01-03.
 * These tests verify the Phase 1 bootstrap behaviors without requiring a live
 * server — they test the controller/gateway logic units directly.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../health/health.controller.js';
import { MetaController } from '../meta/meta.controller.js';

// ────────────────────────────────────────────────────────────────
// Test 1: Health endpoint returns { status: "ok" }
// ────────────────────────────────────────────────────────────────
describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('GET /healthz returns { status: "ok", service: "api" }', () => {
    const result = controller.check();
    expect(result).toEqual({ status: 'ok', service: 'api' });
  });
});

// ────────────────────────────────────────────────────────────────
// Test 2: Metadata endpoint reports rest + websocket + system queue
// ────────────────────────────────────────────────────────────────
describe('MetaController', () => {
  let controller: MetaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetaController],
    }).compile();

    controller = module.get<MetaController>(MetaController);
  });

  it('GET /api/v1/meta reports both transports and system queue', () => {
    const result = controller.getMeta();
    expect(result.service).toBe('api');
    expect(result.transports).toEqual(expect.arrayContaining(['rest', 'websocket']));
    expect(result.queues).toEqual(expect.arrayContaining(['system']));
  });
});
