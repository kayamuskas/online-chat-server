/**
 * PresenceConfig — configurable timing knobs for the presence engine.
 *
 * Production values: afkTimeoutMs = 60 000 (one minute), offlineSweepMs = 5 000.
 * Test values: much smaller so tests do not block for a real minute.
 *
 * Inject via PRESENCE_CONFIG_TOKEN to override in tests.
 *
 * Threat model: T-03-06 — all timing parameters flow through this single
 * config object, so the production one-minute AFK rule cannot be
 * accidentally bypassed in non-test code.
 */

export const PRESENCE_CONFIG_TOKEN = 'PRESENCE_CONFIG';

export interface PresenceConfig {
  /** Milliseconds of inactivity before a tab is considered AFK. */
  afkTimeoutMs: number;
  /** Interval for the background sweep that re-evaluates presence. */
  offlineSweepMs: number;
}

/** Default production config — one-minute AFK, 5-second sweep. */
export const DEFAULT_PRESENCE_CONFIG: PresenceConfig = {
  afkTimeoutMs: 60_000,
  offlineSweepMs: 5_000,
};
