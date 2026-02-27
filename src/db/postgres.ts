/**
 * Database Layer - PostgreSQL Connection and Helpers
 *
 * Provides a connection pool and query helpers for all database operations.
 * Uses the pg library. Run migrations via migrate.ts.
 */

import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ESM equivalent of __dirname (needed for path resolution)
const __dirname = dirname(fileURLToPath(import.meta.url));

// Connection pool - shared across the app
let pool: pg.Pool | null = null;

/** Guild configuration (one row per server) */
export interface GuildConfig {
  guildId: string;
  enabled: number;  // 1 = on, 0 = off
  categoryId: string | null;
  creatorChannelId: string | null;   // "Join To Create" channel
  controlPanelChannelId: string | null;
  controlPanelMessageId: string | null;
  logChannelId: string | null;
  nameTemplate: string;
  brandColor: string;
  cooldownSeconds: number;
  deleteDelaySeconds: number;
  claimTimeoutSeconds: number;
  maxChannelsPerUser: number;
}

/** A user-created voice room (voice + text channel pair) */
export interface VoiceChannel {
  voiceChannelId: string;
  guildId: string;
  textChannelId: string;
  ownerId: string;
  createdAt: number;
  lastOwnerSeenAt: number;
}

/** Cooldown tracking for channel creation (prevents spam) */
export interface Cooldown {
  guildId: string;
  userId: string;
  lastCreatedAt: number;
}

/** Get or create the connection pool. Uses DATABASE_URL from env. */
export function getPool(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    pool = new pg.Pool({
      connectionString: url,
      max: 10,  // Max connections in pool
    });
  }
  return pool;
}

/** Run a query and return the full result */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const p = getPool();
  return p.query<T>(sql, params);
}

/** Run a query and return the first row, or null */
export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(sql, params);
  return (result.rows[0] as T | undefined) ?? null;
}

/** Run a query and return all rows as an array */
export async function queryAll<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await query<T>(sql, params);
  return result.rows as T[];
}

/** Run all .sql files in migrations folder, in order. Creates tables if needed. */
export async function initDb(): Promise<void> {
  const migrationsDir = join(__dirname, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();  // Ensures 001 runs before 002, etc.

  for (const file of files) {
    const path = join(migrationsDir, file);
    const sql = readFileSync(path, "utf-8");
    await query(sql);
  }
}

/** Close the pool (used on shutdown) */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
