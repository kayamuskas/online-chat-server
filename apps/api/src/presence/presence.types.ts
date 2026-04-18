/**
 * Presence domain types.
 *
 * These are the locked status values from the raw requirements:
 *   - online:  at least one tab is active
 *   - afk:     all tabs inactive for > afkTimeoutMs
 *   - offline: no tabs connected / all offloaded
 */

export type PresenceStatus = 'online' | 'afk' | 'offline';

/**
 * Runtime record for a single tab/connection.
 *
 * Each connected socket gets its own TabRecord keyed by socket ID.
 * The presence aggregator derives user-level status from all of a
 * user's TabRecords.
 */
export interface TabRecord {
  /** Socket ID, used as the tab/connection identifier. */
  socketId: string;
  /** Last activity timestamp (connect time initially, updated on activity events). */
  lastActivityAt: number; // Unix ms
}

/**
 * Map of all active tabs for a user.
 * Key: socketId
 */
export type UserTabMap = Map<string, TabRecord>;

/**
 * Presence broadcast payload for a set of users.
 * Key: userId, Value: PresenceStatus
 */
export type PresenceMap = Record<string, PresenceStatus>;
