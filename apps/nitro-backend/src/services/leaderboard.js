import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { formatMinor } from '../lib/money.js';
import { weekBounds, publicName } from '../lib/leaderboard.js';
import { activeCurrency } from './wallet.js';

// Net points = payouts received minus stakes, over predictions that have been settled.
const SCORES_SQL = `
  SELECT p.id, p.display_name, p.ghost_mode, p.created_at,
         SUM(CASE WHEN w.status = 'won' THEN w.potential_payout_minor - w.stake_minor ELSE -w.stake_minor END)::bigint AS net_minor,
         COUNT(*)::int AS settled
  FROM wagers w JOIN players p ON p.id = w.player_id
  WHERE w.status IN ('won','lost') AND w.currency = $1 AND w.settled_at >= $2 AND w.settled_at < $3
  GROUP BY p.id
  HAVING COUNT(*) >= $4`;

function range(period) {
  if (period === 'all') return { from: new Date(0), to: new Date('2100-01-01T00:00:00Z'), endsAt: null };
  const { start, end } = weekBounds();
  return { from: start, to: end, endsAt: end };
}

export async function getLeaderboard({ period = 'week', limit = 20 } = {}) {
  const { from, to, endsAt } = range(period);
  const { rows } = await pool.query(
    `${SCORES_SQL} ORDER BY net_minor DESC, settled DESC, created_at ASC LIMIT $5`,
    [activeCurrency(), from, to, env.LEADERBOARD_MIN_SETTLED, limit]);
  return {
    period, endsAt, prizesEnabled: env.WEEKLY_PRIZE_ENABLED === 'true', minSettled: env.LEADERBOARD_MIN_SETTLED,
    entries: rows.map((r, i) => ({
      rank: i + 1, name: publicName(r.display_name, r.ghost_mode, r.id),
      netMinor: Number(r.net_minor), net: formatMinor(Number(r.net_minor)), predictions: r.settled,
    })),
  };
}

export async function getMyRank(playerId, period = 'week') {
  const { from, to } = range(period);
  const { rows } = await pool.query(
    `WITH scores AS (${SCORES_SQL}),
          ranked AS (SELECT id, net_minor, settled, RANK() OVER (ORDER BY net_minor DESC, settled DESC) AS rank FROM scores)
     SELECT rank::int, net_minor, settled FROM ranked WHERE id = $5`,
    [activeCurrency(), from, to, env.LEADERBOARD_MIN_SETTLED, playerId]);
  if (!rows[0]) return { period, ranked: false };
  return { period, ranked: true, rank: rows[0].rank, netMinor: Number(rows[0].net_minor), net: formatMinor(Number(rows[0].net_minor)), predictions: rows[0].settled };
}
