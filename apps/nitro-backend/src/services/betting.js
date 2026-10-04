import { env } from '../config/env.js';
import { withTx } from '../db/tx.js';
import { HttpError } from '../lib/http-error.js';
import { validateWager, planSettlement, planVoid, assertRealMoneyReady } from '../lib/betting-rules.js';
import { centiToOdds, formatMinor } from '../lib/money.js';
import { activeCurrency, getBalanceMinor } from './wallet.js';

// pg returns BIGINT as strings; convert to numbers (safe: amounts stay far below 2^53).
export const mapWager = (r) => ({
  id: r.id, playerId: r.player_id, marketId: r.market_id, outcomeId: r.outcome_id, currency: r.currency,
  stakeMinor: Number(r.stake_minor), stake: formatMinor(Number(r.stake_minor)),
  oddsCenti: r.odds_centi, odds: centiToOdds(r.odds_centi),
  potentialPayoutMinor: Number(r.potential_payout_minor), potentialPayout: formatMinor(Number(r.potential_payout_minor)),
  status: r.status, createdAt: r.created_at, settledAt: r.settled_at,
});

export async function placeWager({ playerId, outcomeId, stakeMinor, acceptedOddsCenti, idempotencyKey }) {
  assertRealMoneyReady(env.REAL_MONEY_ENABLED === 'true');
  const currency = activeCurrency();
  return withTx(async (client) => {
    // Serialises this player's bets, so two simultaneous requests cannot both spend the same balance.
    const { rows: p } = await client.query('SELECT id, self_excluded_until FROM players WHERE id = $1 FOR NO KEY UPDATE', [playerId]);
    if (!p[0]) throw new HttpError(401, 'Account not found.', 'NO_ACCOUNT');

    if (idempotencyKey) {
      const { rows } = await client.query('SELECT * FROM wagers WHERE player_id = $1 AND idempotency_key = $2', [playerId, idempotencyKey]);
      if (rows[0]) return { wager: mapWager(rows[0]), balanceMinor: await getBalanceMinor(client, playerId, currency), replayed: true };
    }

    // FOR SHARE on the market: settlement (FOR UPDATE) waits for in-flight bets, and no bet can slip in after it.
    const { rows: o } = await client.query(
      `SELECT o.id AS outcome_id, o.market_id, o.odds_centi, m.status, m.closes_at
       FROM outcomes o JOIN markets m ON m.id = o.market_id
       WHERE o.id = $1 FOR SHARE OF m`, [outcomeId]);

    const balanceMinor = await getBalanceMinor(client, playerId, currency);
    const { oddsCenti, potentialPayoutMinor } = validateWager({
      row: o[0], stakeMinor, balanceMinor, acceptedOddsCenti, now: new Date(),
      minStakeMinor: env.MIN_STAKE_MINOR, maxStakeMinor: env.MAX_STAKE_MINOR, excludedUntil: p[0].self_excluded_until,
    });

    const { rows: w } = await client.query(
      `INSERT INTO wagers (player_id, market_id, outcome_id, currency, stake_minor, odds_centi, potential_payout_minor, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [playerId, o[0].market_id, outcomeId, currency, stakeMinor, oddsCenti, potentialPayoutMinor, idempotencyKey ?? null]);

    await client.query(
      `INSERT INTO ledger_entries (player_id, currency, amount, kind, ref_id, idempotency_key)
       VALUES ($1,$2,$3,'bet_stake',$4,$5)`, [playerId, currency, -stakeMinor, w[0].id, `stake:${w[0].id}`]);

    return { wager: mapWager(w[0]), balanceMinor: balanceMinor - stakeMinor, replayed: false };
  });
}

export async function listWagers(db, playerId, limit = 50) {
  const { rows } = await db.query(
    `SELECT w.*, oc.label AS outcome_label, m.title AS market_title
     FROM wagers w JOIN outcomes oc ON oc.id = w.outcome_id JOIN markets m ON m.id = w.market_id
     WHERE w.player_id = $1 ORDER BY w.created_at DESC LIMIT $2`, [playerId, limit]);
  return rows.map((r) => ({ ...mapWager(r), outcomeLabel: r.outcome_label, marketTitle: r.market_title }));
}

const lockMarket = async (client, marketId) => {
  const { rows } = await client.query('SELECT id, status FROM markets WHERE id = $1 FOR UPDATE', [marketId]);
  if (!rows[0]) throw new HttpError(404, 'Market not found.', 'MARKET_NOT_FOUND');
  if (rows[0].status === 'settled' || rows[0].status === 'void') {
    throw new HttpError(409, 'Market is already finished.', 'MARKET_FINISHED');
  }
  return rows[0];
};

const openWagers = async (client, marketId) => {
  const { rows } = await client.query("SELECT * FROM wagers WHERE market_id = $1 AND status = 'open' FOR UPDATE", [marketId]);
  return rows.map(mapWager);
};

const audit = (client, actor, action, details) =>
  client.query('INSERT INTO audit_log (actor, action, details) VALUES ($1,$2,$3)', [actor, action, JSON.stringify(details)]);

export async function settleMarket({ marketId, winningOutcomeId, actor }) {
  return withTx(async (client) => {
    await lockMarket(client, marketId);
    const { rows: o } = await client.query('SELECT id FROM outcomes WHERE id = $1 AND market_id = $2', [winningOutcomeId, marketId]);
    if (!o[0]) throw new HttpError(400, 'That outcome does not belong to this market.', 'BAD_OUTCOME');

    const plan = planSettlement(await openWagers(client, marketId), winningOutcomeId);
    let paidOutMinor = 0;
    for (const item of plan) {
      await client.query('UPDATE wagers SET status = $2, settled_at = now() WHERE id = $1', [item.wagerId, item.status]);
      if (item.status === 'won') {
        paidOutMinor += item.payoutMinor;
        await client.query(
          `INSERT INTO ledger_entries (player_id, currency, amount, kind, ref_id, idempotency_key)
           VALUES ($1,$2,$3,'bet_payout',$4,$5) ON CONFLICT (idempotency_key) DO NOTHING`,
          [item.playerId, item.currency, item.payoutMinor, item.wagerId, `payout:${item.wagerId}`]);
      }
    }
    await client.query("UPDATE markets SET status = 'settled', winning_outcome_id = $2, settled_at = now() WHERE id = $1", [marketId, winningOutcomeId]);
    await audit(client, actor, 'market.settle', { marketId, winningOutcomeId, wagers: plan.length, paidOutMinor });
    return { marketId, winningOutcomeId, wagersSettled: plan.length, paidOutMinor };
  });
}

export async function voidMarket({ marketId, actor }) {
  return withTx(async (client) => {
    await lockMarket(client, marketId);
    const refunds = planVoid(await openWagers(client, marketId));
    for (const item of refunds) {
      await client.query("UPDATE wagers SET status = 'void', settled_at = now() WHERE id = $1", [item.wagerId]);
      await client.query(
        `INSERT INTO ledger_entries (player_id, currency, amount, kind, ref_id, idempotency_key)
         VALUES ($1,$2,$3,'bet_refund',$4,$5) ON CONFLICT (idempotency_key) DO NOTHING`,
        [item.playerId, item.currency, item.refundMinor, item.wagerId, `refund:${item.wagerId}`]);
    }
    await client.query("UPDATE markets SET status = 'void', settled_at = now() WHERE id = $1", [marketId]);
    await audit(client, actor, 'market.void', { marketId, refunded: refunds.length });
    return { marketId, refunded: refunds.length };
  });
}

export async function closeMarket({ marketId, actor }) {
  return withTx(async (client) => {
    await lockMarket(client, marketId);
    await client.query("UPDATE markets SET status = 'closed' WHERE id = $1", [marketId]);
    await audit(client, actor, 'market.close', { marketId });
    return { marketId, status: 'closed' };
  });
}
