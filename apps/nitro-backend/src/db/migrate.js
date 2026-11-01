import { readdir, readFile } from 'node:fs/promises';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { isPooledUrl } from '../lib/db-url.js';

const DIR = new URL('./migrations/', import.meta.url);

/** Applies each migrations/*.sql file once, in name order, each inside its own transaction. */
export async function runMigrations() {
  // A pooled (PgBouncer) connection can hand each statement to a different server connection, so a session lock could be
  // left behind and block the next boot forever. Skip the lock there; the app runs as one instance.
  const useLock = !isPooledUrl(env.DATABASE_URL);
  const client = await pool.connect();
  try {
    if (useLock) await client.query('SELECT pg_advisory_lock(727274)'); // one instance migrates at a time
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(new URL(file, DIR), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[DB] migration applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
  } finally {
    if (useLock) { try { await client.query('SELECT pg_advisory_unlock(727274)'); } catch { /* ignore */ } }
    client.release();
  }
}
