/**
 * AuthService — orchestrates registration, sign-in, and session resolution.
 *
 * This is the single service boundary for auth state mutations.
 * Controllers must not call repositories directly; they call AuthService.
 *
 * Phase 2 scope: register, sign-in, current-user, sign-out.
 * Password reset and password change are in Plan 03.
 */

import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from './user.repository.js';
import { SessionRepository } from './session.repository.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { buildSessionExpiry, resolveSessionPolicy } from './session-policy.js';
import type { RegisterInput, SignInInput, PublicUser, Session } from './auth.types.js';

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
  ) {}

  /**
   * Register a new user account.
   *
   * Validates email and username uniqueness before creating the user row.
   * Returns a PublicUser projection — password_hash is never included.
   */
  async register(input: RegisterInput): Promise<PublicUser> {
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

    // Strip password_hash from the returned value
    const { password_hash: _ph, ...publicUser } = user;
    return publicUser;
  }

  /**
   * Authenticate a user and create a durable browser session.
   *
   * Uses verifyPassword to compare the submitted password against the stored
   * hash. On success, creates one session row and returns the session token
   * plus cookie-policy metadata.
   */
  async signIn(input: SignInInput): Promise<SignInResult> {
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
   * same user remain valid (Phase 3 will add broader session management).
   */
  async signOut(sessionToken: string): Promise<void> {
    await this.sessions.delete(sessionToken);
  }
}
