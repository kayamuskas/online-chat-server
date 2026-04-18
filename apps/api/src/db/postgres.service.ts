/**
 * PostgresService — thin wrapper around the `pg` Pool.
 *
 * Reads connection config from the shared RuntimeEnv contract
 * (POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD).
 * Later plans that need database access should inject this service via NestJS DI.
 */

import { Injectable, OnApplicationShutdown, Logger } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { parseRuntimeEnv } from '@chat/shared';

@Injectable()
export class PostgresService implements OnApplicationShutdown {
  private readonly logger = new Logger(PostgresService.name);
  private readonly pool: Pool;

  constructor() {
    const env = parseRuntimeEnv();
    this.pool = new Pool({
      host:     env.POSTGRES_HOST,
      port:     env.POSTGRES_PORT,
      database: env.POSTGRES_DB,
      user:     env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Idle Postgres client error', err);
    });
  }

  /**
   * Execute a parameterised query and return the full QueryResult.
   * Callers should prefer this over direct pool access.
   */
  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>> {
    return this.pool.query<R>(text, values);
  }

  /**
   * Acquire a client for multi-statement transactions.
   * Callers must release the client in a finally block.
   */
  async getClient() {
    return this.pool.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
    this.logger.log('Postgres pool closed');
  }
}
