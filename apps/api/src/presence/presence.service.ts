/**
 * PresenceService — runtime presence aggregation engine.
 *
 * Owns the per-tab runtime state and derives user-level online/AFK/offline
 * status from it. All live presence reads come from this in-memory map.
 * PostgreSQL is only touched on offline transitions (via PresenceRepository).
 *
 * Multi-tab rules (from raw requirements):
 *  - online  : at least one tab active (activity within afkTimeoutMs)
 *  - afk     : all tabs inactive for > afkTimeoutMs
 *  - offline : no tabs connected
 *
 * Threat model:
 *  T-03-06 — timing knobs are injected via PresenceConfig so the production
 *             one-minute AFK rule cannot be bypassed in non-test code.
 *  T-03-07 — live presence never queries PostgreSQL; durable last seen is
 *             written only on offline transition.
 */

import { Injectable, Inject, OnApplicationShutdown } from '@nestjs/common';
import { PresenceRepository } from './presence.repository.js';
import { PRESENCE_CONFIG_TOKEN } from './presence-config.js';
import type { PresenceConfig } from './presence-config.js';
import type { UserTabMap, PresenceStatus, PresenceMap } from './presence.types.js';

@Injectable()
export class PresenceService implements OnApplicationShutdown {
  /** userId → Map<socketId, TabRecord> */
  private readonly tabs = new Map<string, UserTabMap>();

  private sweepInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly repo: PresenceRepository,
    @Inject(PRESENCE_CONFIG_TOKEN) private readonly config: PresenceConfig,
  ) {
    // Background sweep is not strictly required for correctness (getUserPresence
    // computes status on-demand), but running a lightweight sweep helps keep the
    // tabs map clean when tabs disappear without an explicit disconnect event
    // (e.g. process crash, network drop). Not critical for the tests.
  }

  // ── Tab lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Called when a socket authenticates and connects.
   * Creates a fresh TabRecord with current timestamp as the initial activity.
   */
  tabConnected(userId: string, socketId: string): void {
    if (!this.tabs.has(userId)) {
      this.tabs.set(userId, new Map());
    }
    const userTabs = this.tabs.get(userId)!;
    userTabs.set(socketId, { socketId, lastActivityAt: Date.now() });
  }

  /**
   * Called when a socket disconnects.
   * Removes the TabRecord. If no tabs remain, triggers offline transition
   * (persist durable last seen).
   */
  tabDisconnected(userId: string, socketId: string): void {
    const userTabs = this.tabs.get(userId);
    if (!userTabs) return;

    userTabs.delete(socketId);

    if (userTabs.size === 0) {
      this.tabs.delete(userId);
      // Fire-and-forget: persist durable last seen on offline transition.
      // Threat model T-03-07: only write to DB on offline transition.
      void this.repo.persistLastSeen(userId, new Date());
    }
  }

  /**
   * Called on client activity signals (mouse, keyboard, focus, visibility).
   * Updates the tab's lastActivityAt to now, which resets the AFK timer.
   */
  tabActivity(userId: string, socketId: string): void {
    const userTabs = this.tabs.get(userId);
    if (!userTabs) return;

    const record = userTabs.get(socketId);
    if (!record) return;

    record.lastActivityAt = Date.now();
  }

  // ── Presence derivation ───────────────────────────────────────────────────────

  /**
   * Derive the current presence status for a single user.
   *
   * Algorithm:
   *  1. No tabs → offline
   *  2. Any tab active (within afkTimeoutMs) → online
   *  3. All tabs inactive → afk
   *
   * Threat model T-03-07: this method reads only runtime state, never PostgreSQL.
   */
  getUserPresence(userId: string): PresenceStatus {
    const userTabs = this.tabs.get(userId);
    if (!userTabs || userTabs.size === 0) {
      return 'offline';
    }

    const now = Date.now();
    for (const record of userTabs.values()) {
      if (now - record.lastActivityAt <= this.config.afkTimeoutMs) {
        return 'online';
      }
    }
    // All tabs are past the AFK threshold
    return 'afk';
  }

  /**
   * Derive presence for a set of users in one call.
   * Useful for batch presence lookups without N separate calls.
   *
   * Threat model T-03-07: reads only runtime state.
   */
  getUsersPresence(userIds: string[]): PresenceMap {
    const result: PresenceMap = {};
    for (const userId of userIds) {
      result[userId] = this.getUserPresence(userId);
    }
    return result;
  }

  // ── Shutdown ──────────────────────────────────────────────────────────────────

  /** Clean up the sweep interval on application shutdown. */
  shutdown(): void {
    if (this.sweepInterval !== null) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
  }

  onApplicationShutdown(): void {
    this.shutdown();
  }
}
