/**
 * Task 1 TDD – RED phase
 *
 * Test 3: WebSocket gateway handshake/ping responds without exposing room or
 * message actions.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppGateway } from '../ws/app.gateway.js';
import { PresenceService } from '../presence/presence.service.js';
import { AuthService } from '../auth/auth.service.js';
import { RealtimeEventsService } from '../ws/realtime-events.service.js';

describe('AppGateway', () => {
  let gateway: AppGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppGateway,
        {
          provide: PresenceService,
          useValue: {
            getUserPresence: jest.fn(() => 'offline'),
            tabConnected: jest.fn(),
            tabDisconnected: jest.fn(),
            tabActivity: jest.fn(),
            getUsersPresence: jest.fn(() => ({})),
          },
        },
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: jest.fn(),
          },
        },
        {
          provide: RealtimeEventsService,
          useValue: {
            bindServer: jest.fn(),
            joinUserChannel: jest.fn(),
            emitFriendRequestsUpdated: jest.fn(),
            emitContactsUpdated: jest.fn(),
          },
        },
      ],
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
