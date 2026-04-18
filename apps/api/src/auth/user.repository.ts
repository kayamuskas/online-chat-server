/**
 * UserRepository — persistence boundary for user records.
 *
 * All SQL interactions with the `users` table are isolated here.
 * Controllers and services must not issue SQL directly.
 *
 * Username is write-once: no update path for username is exposed.
 */

import { Injectable } from '@nestjs/common';
import { PostgresService } from '../db/postgres.service.js';
import type { User } from './auth.types.js';
import { randomUUID } from 'node:crypto';

export interface CreateUserInput {
  email: string;
  username: string;
  password_hash: string;
}

@Injectable()
export class UserRepository {
  constructor(private readonly db: PostgresService) {}

  /** Find a user by email for sign-in lookup. Returns null if not found. */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query<User>(
      'SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE email = $1 LIMIT 1',
      [email],
    );
    return result.rows[0] ?? null;
  }

  /** Find a user by username for registration uniqueness check. Returns null if not found. */
  async findByUsername(username: string): Promise<User | null> {
    const result = await this.db.query<User>(
      'SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE username = $1 LIMIT 1',
      [username],
    );
    return result.rows[0] ?? null;
  }

  /** Find a user by UUID primary key. Returns null if not found. */
  async findById(id: string): Promise<User | null> {
    const result = await this.db.query<User>(
      'SELECT id, email, username, password_hash, created_at, updated_at FROM users WHERE id = $1 LIMIT 1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  /**
   * Persist a new user row. Returns the created user.
   * Uniqueness constraints are enforced at the database level — callers
   * should check findByEmail/findByUsername before calling this to provide
   * a friendlier conflict message.
   */
  async create(input: CreateUserInput): Promise<User> {
    const id = randomUUID();
    const result = await this.db.query<User>(
      `INSERT INTO users (id, email, username, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, username, password_hash, created_at, updated_at`,
      [id, input.email, input.username, input.password_hash],
    );
    return result.rows[0];
  }

  /**
   * Update the stored password hash for a user (password-change flow).
   * Does NOT expose a username-update path.
   */
  async updatePasswordHash(userId: string, newHash: string): Promise<void> {
    await this.db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, userId],
    );
  }
}
