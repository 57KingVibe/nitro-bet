import { env } from '../config/env.js';
import { activeCurrency } from './wallet.js';

/**
 * Called inside the settlement transaction. When a referred player's first prediction has just been settled,
 * the referrer gets a points bonus (capped per referrer). Points only: never in real-money mode.
 */
export async function payReferralBonuses(client, playerIds) {
  if (env.REAL_MONEY_ENABLED === 'true' || env.REFERRAL_BONUS_MINOR <= 0 || playerIds.length === 0) return 0;
  const { rows } = await client.query(
    `SELECT id, referred_by FROM players
     WHERE id = ANY($1::uuid[]) AND referred_by IS NOT NULL AND referral_paid_at IS NULL
     ORDER BY id FOR UPDATE`, [[...new Set(playerIds)]]);
  let paid = 0;
  for (const r of rows) {
    const { rows: c } = await client.query('SELECT COUNT(*)::int AS n FROM players WHERE referred_by = $1 AND referral_paid_at IS NOT NULL', [r.referred_by]);
    if (c[0].n >= env.REFERRAL_MAX_REWARDS) continue;   // cap reached: leave unpaid
    await client.query(
      `INSERT INTO ledger_entries (player_id, currency, amount, kind, ref_id, idempotency_key)
       VALUES ($1,$2,$3,'referral_bonus',$4,$5) ON CONFLICT (idempotency_key) DO NOTHING`,
      [r.referred_by, activeCurrency(), env.REFERRAL_BONUS_MINOR, r.id, `referral:${r.id}`]);
    await client.query('UPDATE players SET referral_paid_at = now() WHERE id = $1', [r.id]);
    paid++;
  }
  return paid;
}
