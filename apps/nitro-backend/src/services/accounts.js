import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { withTx } from '../db/tx.js';
import { HttpError } from '../lib/http-error.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { formatMinor } from '../lib/money.js';
import { activeCurrency, getBalanceMinor } from './wallet.js';

const signToken = (playerId) =>
  jwt.sign({ sub: playerId }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN });

let dummyHash; // lets a login for an unknown email take as long as a real one
const getDummyHash = async () => (dummyHash ??= await hashPassword('timing-equaliser-password'));

export async function registerPlayer({ email, password, displayName, dateOfBirth, country }) {
  const passwordHash = await hashPassword(password);
  const player = await withTx(async (client) => {
    let row;
    try {
      const res = await client.query(
        `INSERT INTO players (email, password_hash, display_name, date_of_birth, country)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, email, display_name`,
        [email, passwordHash, displayName, dateOfBirth, country ?? null]);
      row = res.rows[0];
    } catch (err) {
      if (err.code === '23505') throw new HttpError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
      throw err;
    }
    if (env.REAL_MONEY_ENABLED !== 'true' && env.SIGNUP_CREDIT_MINOR > 0) {
      await client.query(
        `INSERT INTO ledger_entries (player_id, currency, amount, kind, idempotency_key)
         VALUES ($1,'PLAY',$2,'signup_credit',$3)`,
        [row.id, env.SIGNUP_CREDIT_MINOR, `signup:${row.id}`]);
    }
    return row;
  });
  return { token: signToken(player.id), player: { id: player.id, email: player.email, displayName: player.display_name } };
}

export async function loginPlayer({ email, password }) {
  const { rows } = await pool.query(
    'SELECT id, email, display_name, password_hash FROM players WHERE lower(email) = lower($1)', [email]);
  const row = rows[0];
  const ok = await verifyPassword(password, row ? row.password_hash : await getDummyHash());
  if (!row || !ok) throw new HttpError(401, 'Invalid email or password.', 'BAD_CREDENTIALS');
  return { token: signToken(row.id), player: { id: row.id, email: row.email, displayName: row.display_name } };
}

export async function getProfile(playerId) {
  const { rows } = await pool.query(
    'SELECT id, email, display_name, self_excluded_until FROM players WHERE id = $1', [playerId]);
  if (!rows[0]) throw new HttpError(401, 'Account not found.', 'NO_ACCOUNT');
  const balanceMinor = await getBalanceMinor(pool, playerId);
  return {
    id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name,
    currency: activeCurrency(), realMoney: env.REAL_MONEY_ENABLED === 'true',
    balanceMinor, balance: formatMinor(balanceMinor),
    selfExcludedUntil: rows[0].self_excluded_until,
  };
}

/** Can only be extended, never shortened. */
export async function selfExclude(playerId, days) {
  const { rows } = await pool.query(
    `UPDATE players SET self_excluded_until = GREATEST(COALESCE(self_excluded_until, now()), now() + make_interval(days => $2::int))
     WHERE id = $1 RETURNING self_excluded_until`, [playerId, days]);
  if (!rows[0]) throw new HttpError(401, 'Account not found.', 'NO_ACCOUNT');
  return { selfExcludedUntil: rows[0].self_excluded_until };
}
