/**
 * PresenceService unit tests — TDD RED phase (Task 1 + Task 2)
 *
 * Covers:
 *  - Single-tab online / AFK / offline state machine
 *  - Multi-tab aggregation: one active tab keeps user online
 *  - AFK applies only when ALL tabs are inactive for > afkTimeout
 *  - Offline applies only when all tabs are closed/disconnected
 *  - Heartbeat extends activity window correctly
 *  - Durable `last seen` persisted on offline transition (Task 2)
 *  - Live presence lookups do NOT query PostgreSQL (Task 2)
 *
 * Uses accelerated timers (5 ms AFK, 50 ms offline sweep) so tests
 * do not wait the production one-minute threshold.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PresenceService } from '../../presence/presence.service.js';
import type { PresenceRepository } from '../../presence/presence.repository.js';
import { PRESENCE_CONFIG_TOKEN } from '../../presence/presence-config.js';
import type { PresenceConfig } from '../../presence/presence-config.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRepo(): PresenceRepository {
  return {
    persistLastSeen: vi.fn().mockResolvedValue(undefined),
  } as unknown as PresenceRepository;
}

const FAST_CONFIG: PresenceConfig = {
  afkTimeoutMs: 10,       // 10 ms instead of 60 000 ms
  offlineSweepMs: 50,     // sweep every 50 ms
};

function makeService(repo?: PresenceRepository, config?: Partial<PresenceConfig>): PresenceService {
  const r = repo ?? makeRepo();
  const c: PresenceConfig = { ...FAST_CONFIG, ...config };
  return new PresenceService(r, c);
}

// ── presence status helpers ───────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PresenceService', () => {
  let service: PresenceService;
  let repo: PresenceRepository;

  beforeEach(() => {
    repo = makeRepo();
    service = makeService(repo);
  });

  afterEach(() => {
    service.shutdown();
  });

  // ── Single tab state machine ─────────────────────────────────────────────────

  describe('single tab', () => {
    it('is online immediately after a tab connects', () => {
      service.tabConnected('user-1', 'tab-a');
      expect(service.getUserPresence('user-1')).toBe('online');
    });

    it('remains online while heartbeats arrive before afkTimeout', async () => {
      service.tabConnected('user-1', 'tab-a');
      service.tabActivity('user-1', 'tab-a');
      await sleep(5);
      service.tabActivity('user-1', 'tab-a');
      await sleep(5);
      expect(service.getUserPresence('user-1')).toBe('online');
    });

    it('becomes AFK when the tab is inactive for longer than afkTimeout', async () => {
      service.tabConnected('user-1', 'tab-a');
      // do NOT send activity; wait past the AFK threshold
      await sleep(30); // 30 ms > 10 ms afkTimeout
      expect(service.getUserPresence('user-1')).toBe('afk');
    });

    it('transitions back to online when activity resumes after AFK', async () => {
      service.tabConnected('user-1', 'tab-a');
      await sleep(30); // go AFK
      expect(service.getUserPresence('user-1')).toBe('afk');
      service.tabActivity('user-1', 'tab-a');
      expect(service.getUserPresence('user-1')).toBe('online');
    });

    it('is offline when the only tab disconnects', async () => {
      service.tabConnected('user-1', 'tab-a');
      service.tabDisconnected('user-1', 'tab-a');
      expect(service.getUserPresence('user-1')).toBe('offline');
    });

    it('returns offline for an unknown user', () => {
      expect(service.getUserPresence('nobody')).toBe('offline');
    });
  });

  // ── Multi-tab aggregation ─────────────────────────────────────────────────────

  describe('multi-tab aggregation', () => {
    it('stays online when one of two tabs is active and the other is not', async () => {
      service.tabConnected('user-2', 'tab-a');
      service.tabConnected('user-2', 'tab-b');
      // only tab-a receives activity; tab-b goes idle
      service.tabActivity('user-2', 'tab-a');
      await sleep(30); // tab-b would be AFK alone
      // tab-a still active, so user stays online
      service.tabActivity('user-2', 'tab-a');
      expect(service.getUserPresence('user-2')).toBe('online');
    });

    it('becomes AFK only when ALL tabs are inactive for afkTimeout', async () => {
      service.tabConnected('user-2', 'tab-a');
      service.tabConnected('user-2', 'tab-b');
      // neither tab sends activity
      await sleep(30); // both tabs idle > 10 ms
      expect(service.getUserPresence('user-2')).toBe('afk');
    });

    it('is online if one tab becomes active after all were AFK', async () => {
      service.tabConnected('user-2', 'tab-a');
      service.tabConnected('user-2', 'tab-b');
      await sleep(30); // go AFK
      service.tabActivity('user-2', 'tab-b'); // one tab wakes up
      expect(service.getUserPresence('user-2')).toBe('online');
    });

    it('is offline only when all tabs disconnect', () => {
      service.tabConnected('user-2', 'tab-a');
      service.tabConnected('user-2', 'tab-b');
      service.tabDisconnected('user-2', 'tab-a');
      expect(service.getUserPresence('user-2')).toBe('online'); // tab-b still there (just connected, not AFK yet)
      service.tabDisconnected('user-2', 'tab-b');
      expect(service.getUserPresence('user-2')).toBe('offline');
    });

    it('reconnected tab restores presence after all tabs were offline', () => {
      service.tabConnected('user-2', 'tab-a');
      service.tabDisconnected('user-2', 'tab-a');
      expect(service.getUserPresence('user-2')).toBe('offline');
      service.tabConnected('user-2', 'tab-a');
      expect(service.getUserPresence('user-2')).toBe('online');
    });
  });

  // ── Durable last seen (Task 2) ────────────────────────────────────────────────

  describe('durable last seen persistence', () => {
    it('calls persistLastSeen when the last tab disconnects (offline transition)', async () => {
      service.tabConnected('user-3', 'tab-a');
      service.tabDisconnected('user-3', 'tab-a');
      // allow microtask queue to flush
      await sleep(5);
      expect(repo.persistLastSeen).toHaveBeenCalledWith('user-3', expect.any(Date));
    });

    it('does NOT call persistLastSeen when one of multiple tabs disconnects', async () => {
      service.tabConnected('user-3', 'tab-a');
      service.tabConnected('user-3', 'tab-b');
      service.tabDisconnected('user-3', 'tab-a');
      await sleep(5);
      expect(repo.persistLastSeen).not.toHaveBeenCalled();
    });

    it('does NOT call persistLastSeen on a pure activity event', async () => {
      service.tabConnected('user-3', 'tab-a');
      service.tabActivity('user-3', 'tab-a');
      await sleep(5);
      expect(repo.persistLastSeen).not.toHaveBeenCalled();
    });

    it('calls persistLastSeen with a recent timestamp on offline transition', async () => {
      const before = new Date();
      service.tabConnected('user-3', 'tab-a');
      service.tabDisconnected('user-3', 'tab-a');
      await sleep(5);
      const calls = vi.mocked(repo.persistLastSeen).mock.calls;
      expect(calls.length).toBe(1);
      const [, ts] = calls[0] as [string, Date];
      expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  // ── Live presence does NOT query PostgreSQL ───────────────────────────────────

  describe('live presence reads do not touch DB', () => {
    it('returns presence without calling persistLastSeen', () => {
      service.tabConnected('user-4', 'tab-a');
      service.getUserPresence('user-4');
      expect(repo.persistLastSeen).not.toHaveBeenCalled();
    });
  });

  // ── Presence broadcast list ───────────────────────────────────────────────────

  describe('getUsersPresence (batch query)', () => {
    it('returns correct statuses for multiple users without DB calls', () => {
      service.tabConnected('u-1', 'tab-a');
      service.tabConnected('u-2', 'tab-b');
      service.tabDisconnected('u-2', 'tab-b');

      const map = service.getUsersPresence(['u-1', 'u-2', 'u-unknown']);
      expect(map['u-1']).toBe('online');
      expect(map['u-2']).toBe('offline');
      expect(map['u-unknown']).toBe('offline');
      expect(repo.persistLastSeen).not.toHaveBeenCalled();
    });
  });
});
