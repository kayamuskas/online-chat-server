/**
 * AuthService — orchestrates registration, sign-in, and session resolution.
 *
 * This is the single service boundary for auth state mutations.
 * Controllers must not call repositories directly; they call AuthService.
 *
 * Phase 2 scope: register, sign-in, current-user, sign-out.
 * Phase 3 adds: session inventory, per-session revoke, sign-out-all-other-sessions.
 */

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { UserRepository } from './user.repository.js';
import { SessionRepository } from './session.repository.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { RoomsRepository } from '../rooms/rooms.repository.js';
import { ContactsRepository } from '../contacts/contacts.repository.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { buildSessionExpiry, resolveSessionPolicy } from './session-policy.js';
import type {
  RegisterInput,
  SignInInput,
  PublicUser,
  Session,
  SessionInventoryItem,
} from './auth.types.js';
import type { ClientMetadata } from './session-metadata.js';

export interface SignInResult {
  user: PublicUser;
  sessionToken: string;
  sessionTtlSeconds: number;
  isPersistent: boolean;
}

export interface CurrentUserResult {
  user: PublicUser;
  session: Session;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    @Inject(forwardRef(() => RoomsService))
    private readonly roomsService: RoomsService,
    @Inject(forwardRef(() => RoomsRepository))
    private readonly roomsRepo: RoomsRepository,
    @Inject(forwardRef(() => ContactsRepository))
    private readonly contactsRepo: ContactsRepository,
  ) {}

  /**
   * Register a new user account.
   *
   * Validates email and username uniqueness before creating the user row.
   * Returns a PublicUser projection — password_hash is never included.
   */
  async register(input: RegisterInput, metadata?: ClientMetadata): Promise<SignInResult> {
    // Check email uniqueness
    const existingByEmail = await this.users.findByEmail(input.email);
    if (existingByEmail) {
      throw new ConflictException('email is already registered');
    }

    // Check username uniqueness
    const existingByUsername = await this.users.findByUsername(input.username);
    if (existingByUsername) {
      throw new ConflictException('username is already taken');
    }

    const password_hash = await hashPassword(input.password);
    const user = await this.users.create({
      email: input.email,
      username: input.username,
      password_hash,
    });

    // Auto sign-in: create a session immediately after registration
    const policy = resolveSessionPolicy(false);
    const { expiresAt, sessionTtlSeconds, isPersistent } = buildSessionExpiry(policy);
    const session = await this.sessions.create({
      userId: user.id,
      isPersistent,
      expiresAt,
      ipAddress: metadata?.ip_address ?? null,
      userAgent: metadata?.user_agent ?? null,
    });

    const { password_hash: _ph, ...publicUser } = user;
    return {
      user: publicUser,
      sessionToken: session.session_token,
      sessionTtlSeconds,
      isPersistent,
    };
  }

  /**
   * Authenticate a user and create a durable browser session.
   *
   * Uses verifyPassword to compare the submitted password against the stored
   * hash. On success, creates one session row and returns the session token
   * plus cookie-policy metadata.
   *
   * Phase 3: accepts optional client metadata (IP, user-agent) to persist
   * with the session row for inventory display.
   */
  async signIn(input: SignInInput, metadata?: ClientMetadata): Promise<SignInResult> {
    const user = await this.users.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('invalid email or password');
    }

    const valid = await verifyPassword(input.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('invalid email or password');
    }

    const policy = resolveSessionPolicy(input.keepSignedIn);
    const { expiresAt, sessionTtlSeconds, isPersistent } = buildSessionExpiry(policy);

    const session = await this.sessions.create({
      userId: user.id,
      isPersistent,
      expiresAt,
      ipAddress: metadata?.ip_address ?? null,
      userAgent: metadata?.user_agent ?? null,
    });

    const { password_hash: _ph, ...publicUser } = user;
    return {
      user: publicUser,
      sessionToken: session.session_token,
      sessionTtlSeconds,
      isPersistent,
    };
  }

  /**
   * Resolve the current authenticated user from an opaque session token.
   *
   * Returns null if the token does not exist or has expired. On success,
   * returns the PublicUser and the Session row (the caller can use the
   * session for sign-out or idle-timeout refresh).
   */
  async getCurrentUser(sessionToken: string): Promise<CurrentUserResult | null> {
    const session = await this.sessions.findByToken(sessionToken);
    if (!session) return null;

    // Enforce server-side expiry (belt-and-suspenders over cookie MaxAge)
    if (session.expires_at < new Date()) {
      return null;
    }

    const user = await this.users.findById(session.user_id);
    if (!user) return null;

    const { password_hash: _ph, ...publicUser } = user;
    return { user: publicUser, session };
  }

  /**
   * Sign out the current browser session by deleting its session row.
   *
   * Only the presented session token is invalidated. Other sessions for the
   * same user remain valid.
   */
  async signOut(sessionToken: string): Promise<void> {
    await this.sessions.delete(sessionToken);
  }

  // ── Phase 3: Session inventory and targeted revoke ───────────────────────────

  /**
   * List all active sessions for the authenticated user.
   *
   * Returns sessions ordered with the current session first, then by
   * last_seen_at descending. Each item includes an isCurrentSession marker
   * for the "This browser" badge in the session inventory UI.
   *
   * Threat model: T-03-03 — scoped strictly to the caller's user_id.
   */
  async listSessions(userId: string, currentToken: string): Promise<SessionInventoryItem[]> {
    const rows = await this.sessions.findAllByUserId(userId);

    const items: SessionInventoryItem[] = rows.map((row) => ({
      sessionId: row.id,
      ipAddress: row.ip_address ?? null,
      userAgent: row.user_agent ?? null,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
      isPersistent: row.is_persistent,
      isCurrentSession: row.session_token === currentToken,
    }));

    // Sort: current session first, then by lastSeenAt descending
    items.sort((a, b) => {
      if (a.isCurrentSession && !b.isCurrentSession) return -1;
      if (!a.isCurrentSession && b.isCurrentSession) return 1;
      return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
    });

    return items;
  }

  /**
   * Revoke a single session by its ID, scoped to the authenticated user.
   *
   * Throws NotFoundException if the session does not belong to the user.
   * Revoking the current session is explicitly supported — the caller
   * (controller) is responsible for clearing the session cookie when needed.
   *
   * Threat model: T-03-04 — row-level revoke with user_id predicate.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.sessions.deleteById(sessionId, userId);
  }

  /**
   * Revoke all sessions for the authenticated user except the current one.
   *
   * The current session is preserved so the user remains signed in on this
   * browser. This is the `sign out all other sessions` operation.
   *
   * Threat model: T-03-04 — targeted bulk revoke excluding current token.
   */
  async revokeAllOtherSessions(userId: string, currentToken: string): Promise<void> {
    await this.sessions.deleteAllOtherByUserId(userId, currentToken);
  }

  /**
   * Delete the user's account with full cascade (D-10, D-15):
   *   1. Verify password (D-10)
   *   2. Delete owned rooms — each triggers room:deleted WS broadcast + full cascade (D-11)
   *   3. Strip admin roles in non-owned rooms (D-12)
   *   4. Remove remaining memberships
   *   5. Delete contacts/friendships/bans
   *   6. Delete DM conversations — NOT messages (D-13)
   *   7. Delete all sessions (D-14)
   *   8. Delete user record — FK ON DELETE SET NULL preserves DM messages
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    // D-10: verify password before proceeding
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Incorrect password');

    // D-11: delete owned rooms (each with WS broadcast + full cascade)
    const ownedRooms = await this.roomsService.listOwnedRooms(userId);
    for (const room of ownedRooms) {
      await this.roomsService.deleteRoom(room.id, userId);
    }

    // D-12: strip admin roles in non-owned rooms
    await this.roomsRepo.removeAdminFromAllRooms(userId);

    // D-15: remove remaining memberships
    await this.roomsRepo.removeMemberFromAllRooms(userId);

    // D-15: delete contacts/friendships/bans
    await this.contactsRepo.deleteAllFor(userId);

    // D-13, D-15: delete DM conversations (NOT messages — messages preserved with author_id SET NULL)
    await this.contactsRepo.deleteDmConversationsFor(userId);

    // D-14: delete all sessions (WS sockets get 401 on next auth check)
    await this.sessions.deleteAllByUserId(userId);

    // Final: delete user record (FK ON DELETE SET NULL handles remaining message/attachment refs)
    await this.users.deleteById(userId);
  }
}
