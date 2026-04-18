/**
 * Task 1 TDD – RED phase
 *
 * Test 3: WebSocket gateway handshake/ping responds without exposing room or
 * message actions.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppGateway } from '../ws/app.gateway.js';

describe('AppGateway', () => {
  let gateway: AppGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppGateway],
    }).compile();

    gateway = module.get<AppGateway>(AppGateway);
  });

  it('handlePing returns a pong payload with status ready', () => {
    const result = gateway.handlePing();
    expect(result).toEqual(expect.objectContaining({ event: 'pong' }));
  });

  it('gateway does NOT expose sendMessage or joinRoom handlers', () => {
    // Phase 1 boundary: these domain methods must not exist yet
    expect(typeof (gateway as unknown as Record<string, unknown>)['sendMessage']).toBe('undefined');
    expect(typeof (gateway as unknown as Record<string, unknown>)['joinRoom']).toBe('undefined');
  });
});
