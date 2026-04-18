/**
 * session-metadata.ts — centralized client metadata extraction for session rows.
 *
 * All session creation paths use this module to extract IP and user-agent data
 * from the incoming request. Centralizing here ensures that session inventory,
 * rate limiting, and future security surfaces use a consistent extraction strategy.
 *
 * Threat model: T-03-01 — client IP metadata extraction with X-Forwarded-For fallback.
 *
 * IP extraction priority:
 *   1. X-Forwarded-For header (first value, for proxied deployments)
 *   2. Express/NestJS request.ip
 *   3. socket.remoteAddress (direct connection fallback)
 *   4. "unknown" sentinel when no address is available
 */

/** Minimal request shape needed for metadata extraction. */
export interface MetadataRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket: { remoteAddress?: string };
}

/** The metadata extracted from an incoming request at session-creation time. */
export interface ClientMetadata {
  ip_address: string;
  user_agent: string | null;
}

function shouldTrustProxy(): boolean {
  const value = process.env['TRUST_PROXY'];
  if (!value) return true;

  const normalized = value.trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0';
}

/**
 * Extract the normalized client IP address from the request.
 *
 * Trusts the first value in X-Forwarded-For for proxied deployments.
 * Falls back to direct connection addresses when the header is absent.
 *
 * Note: In production, ensure the reverse proxy is trusted and that
 * X-Forwarded-For is set by the proxy, not spoofed by the client.
 * The extraction is consistent with how auth-rate-limit.guard.ts resolves IPs.
 */
export function extractClientIp(req: MetadataRequest): string {
  if (shouldTrustProxy()) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim() !== '') {
      const first = forwardedFor.split(',')[0].trim();
      if (first !== '') return first;
    }
  }

  if (req.ip && req.ip.trim() !== '') {
    return req.ip.trim();
  }

  if (req.socket.remoteAddress && req.socket.remoteAddress.trim() !== '') {
    return req.socket.remoteAddress.trim();
  }

  return 'unknown';
}

/**
 * Build the full ClientMetadata object from the request.
 *
 * Captures IP via extractClientIp and raw user-agent string from the
 * User-Agent header. The user-agent is stored raw so future surfaces can
 * derive display labels (e.g., "Chrome · macOS") without re-parsing at
 * inventory-read time.
 */
export function buildSessionMetadata(req: MetadataRequest): ClientMetadata {
  const ip_address = extractClientIp(req);

  const userAgentHeader = req.headers['user-agent'];
  const user_agent =
    typeof userAgentHeader === 'string' && userAgentHeader.trim() !== ''
      ? userAgentHeader.trim()
      : null;

  return { ip_address, user_agent };
}
