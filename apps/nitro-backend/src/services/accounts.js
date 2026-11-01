import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { withTx } from '../db/tx.js';
import { HttpError } from '../lib/http-error.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { formatMinor } from '../lib/money.js';
import { activeCurrency, getBalanceMinor } from './wallet.js';
import { verifyGoogleIdToken } from '../lib/google.js';
import { generateReferralCode, normalizeRef } from '../lib/referral.js';

const signToken = (playerId) =>
  jwt.sign({ sub: playerId }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN });

let dummyHash; // lets a login for an unknown email take as long as a real one
const getDummyHash = async () => (dummyHash ??= await hashPassword('timing-equaliser-password'));

const sessionOf = (row) => ({ token: signToken(row.id), player: { id: row.id, email: row.email, displayName: row.display_name } });

/** Inserts the player, the welcome points and the referral link inside one transaction. */
async function insertPlayer(client, { email, passwordHash, displayName, dateOfBirth, country, googleSub, ref }) {
  let referredBy = null;
  const code = normalizeRef(ref);
  if (code) {
    const { rows } = await client.query('SELECT id FROM players WHERE referral_code = $1', [code]);
    referredBy = rows[0]?.id ?? null;
  }
  let row;
  try {
    const res = await client.query(
      `INSERT INTO players (email, password_hash, display_name, date_of_birth, country, google_sub, referred_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, email, display_name`,
      [email, passwordHash, displayName, dateOfBirth, country ?? null, googleSub ?? null, referredBy]);
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
}

/** Gives the player a referral code if they do not have one yet (retries on the rare clash). */
export async function ensureReferralCode(playerId) {
  const { rows } = await pool.query('SELECT referral_code FROM players WHERE id = $1', [playerId]);
  if (!rows[0]) throw new HttpError(401, 'Account not found.', 'NO_ACCOUNT');
  if (rows[0].referral_code) return rows[0].referral_code;
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    try {
      const res = await pool.query('UPDATE players SET referral_code = $2 WHERE id = $1 AND referral_code IS NULL RETURNING referral_code', [playerId, code]);
      if (res.rows[0]) return res.rows[0].referral_code;
      const again = await pool.query('SELECT referral_code FROM players WHERE id = $1', [playerId]);
      return again.rows[0].referral_code;
    } catch (err) { if (err.code !== '23505') throw err; }
  }
  throw new HttpError(500, 'Could not create a referral code. Please try again.', 'REFERRAL_CODE');
}

export async function registerPlayer({ email, password, displayName, dateOfBirth, country, ref }) {
  const passwordHash = await hashPassword(password);
  const row = await withTx((client) => insertPlayer(client, { email, passwordHash, displayName, dateOfBirth, country, ref }));
  await ensureReferralCode(row.id).catch(() => {});
  return sessionOf(row);
}

/**
 * Google sign-in. An existing Google account just signs in. A new one must first confirm it is an adult:
 * without a date of birth we answer { needsSignup: true } and the page asks for it.
 * An email that already has a password account is never linked automatically (that would let someone who
 * pre-registered another person's email keep access).
 */
export async function googleAuth({ credential, dateOfBirth, country, ref }) {
  if (!env.GOOGLE_CLIENT_ID) throw new HttpError(503, 'Google sign-in is not set up yet.', 'GOOGLE_OFF');
  const g = await verifyGoogleIdToken(credential, { clientId: env.GOOGLE_CLIENT_ID });
  const { rows } = await pool.query(
    'SELECT id, email, display_name, google_sub FROM players WHERE google_sub = $1 OR lower(email) = $2', [g.sub, g.email]);
  const linked = rows.find((r) => r.google_sub === g.sub);
  if (linked) return sessionOf(linked);
  if (rows.length > 0) throw new HttpError(409, 'An account with this email already exists. Sign in with your password.', 'EMAIL_TAKEN_PASSWORD');
  if (!dateOfBirth) return { needsSignup: true, email: g.email, name: g.name };
  const displayName = (g.name || g.email.split('@')[0]).replace(/\s+/g, ' ').trim().slice(0, 30).padEnd(2, '_');
  const row = await withTx((client) => insertPlayer(client, { email: g.email, passwordHash: null, displayName, dateOfBirth, country, googleSub: g.sub, ref }));
  await ensureReferralCode(row.id).catch(() => {});
  return sessionOf(row);
}

export async function referralSummary(playerId) {
  const code = await ensureReferralCode(playerId);
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS invited, COUNT(referral_paid_at)::int AS rewarded FROM players WHERE referred_by = $1`, [playerId]);
  return {
    code, invited: rows[0].invited, rewarded: rows[0].rewarded, pending: rows[0].invited - rows[0].rewarded,
    bonus: formatMinor(env.REFERRAL_BONUS_MINOR), maxRewards: env.REFERRAL_MAX_REWARDS,
  };
}

export async function loginPlayer({ email, password }) {
  const { rows } = await pool.query(
    'SELECT id, email, display_name, password_hash FROM players WHERE lower(email) = lower($1)', [email]);
  const row = rows[0];
  if (row && !row.password_hash) throw new HttpError(401, 'This account uses Google sign-in. Use "Continue with Google".', 'USE_GOOGLE');
  const ok = await verifyPassword(password, row ? row.password_hash : await getDummyHash());
  if (!row || !ok) throw new HttpError(401, 'Invalid email or password.', 'BAD_CREDENTIALS');
  return { token: signToken(row.id), player: { id: row.id, email: row.email, displayName: row.display_name } };
}

export async function getProfile(playerId) {
  const { rows } = await pool.query(
    'SELECT id, email, display_name, self_excluded_until, ghost_mode FROM players WHERE id = $1', [playerId]);
  if (!rows[0]) throw new HttpError(401, 'Account not found.', 'NO_ACCOUNT');
  const balanceMinor = await getBalanceMinor(pool, playerId);
  return {
    id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name,
    currency: activeCurrency(), realMoney: env.REAL_MONEY_ENABLED === 'true',
    balanceMinor, balance: formatMinor(balanceMinor),
    selfExcludedUntil: rows[0].self_excluded_until, ghostMode: rows[0].ghost_mode,
  };
}

export async function updateSettings(playerId, { ghostMode }) {
  const { rows } = await pool.query('UPDATE players SET ghost_mode = $2 WHERE id = $1 RETURNING ghost_mode', [playerId, ghostMode]);
  if (!rows[0]) throw new HttpError(401, 'Account not found.', 'NO_ACCOUNT');
  return { ghostMode: rows[0].ghost_mode };
}

/** Can only be extended, never shortened. */
export async function selfExclude(playerId, days) {
  const { rows } = await pool.query(
    `UPDATE players SET self_excluded_until = GREATEST(COALESCE(self_excluded_until, now()), now() + make_interval(days => $2::int))
     WHERE id = $1 RETURNING self_excluded_until`, [playerId, days]);
  if (!rows[0]) throw new HttpError(401, 'Account not found.', 'NO_ACCOUNT');
  return { selfExcludedUntil: rows[0].self_excluded_until };
}
