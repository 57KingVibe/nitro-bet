import pkg from 'pg';
import { env } from './env.js';

const { Pool } = pkg;

const useSsl = env.DATABASE_SSL ? env.DATABASE_SSL === 'true' : env.NODE_ENV === 'production';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // 2s was too tight for a cold free-tier Postgres
});

// An unhandled 'error' event on the pool (e.g. a dropped idle connection) would crash the process.
pool.on('error', (err) => console.error('[DB] idle client error:', err.message));

export const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address VARCHAR(42) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        event_id VARCHAR(100) NOT NULL,
        selection VARCHAR(100) NOT NULL,
        stake DECIMAL(18, 8) NOT NULL CHECK (stake > 0),
        odds DECIMAL(8, 4) NOT NULL CHECK (odds > 1.0),
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'WON', 'LOST', 'CANCELLED')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(18, 8) NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("[DB] PostgreSQL schema verified.");
  } catch (err) {
    console.error("[DB] PostgreSQL initialization error:", err);
    throw err;
  } finally {
    client.release();
  }
};
