import { env } from '../config/env.js';
import { formatMinor } from '../lib/money.js';

// Play-money and real-money balances live in separate currencies of the same ledger.
export const activeCurrency = () => (env.REAL_MONEY_ENABLED === 'true' ? 'USD' : 'PLAY');

/** `db` is the pool or a transaction client. */
export async function getBalanceMinor(db, playerId, currency = activeCurrency()) {
  const { rows } = await db.query(
    'SELECT COALESCE(SUM(amount), 0)::text AS balance FROM ledger_entries WHERE player_id = $1 AND currency = $2',
    [playerId, currency]
  );
  return Number(rows[0].balance);
}

export async function listLedger(db, playerId, limit = 50) {
  const { rows } = await db.query(
    `SELECT id, kind, amount, currency, created_at FROM ledger_entries
     WHERE player_id = $1 ORDER BY id DESC LIMIT $2`, [playerId, limit]);
  return rows.map((r) => ({
    id: Number(r.id), kind: r.kind, currency: r.currency,
    amountMinor: Number(r.amount), amount: formatMinor(Number(r.amount)), createdAt: r.created_at,
  }));
}
