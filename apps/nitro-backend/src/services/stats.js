import { pool } from '../config/db.js';

/** Numbers for the operator: how many people signed up, who is active, how the referral program is doing. */
export async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM players)::int                                                        AS players_total,
      (SELECT COUNT(*) FROM players WHERE created_at > now() - interval '1 day')::int            AS players_last_24h,
      (SELECT COUNT(*) FROM players WHERE created_at > now() - interval '7 days')::int           AS players_last_7d,
      (SELECT COUNT(*) FROM players WHERE google_sub IS NOT NULL)::int                           AS signed_up_with_google,
      (SELECT COUNT(*) FROM player_wallets)::int                                                 AS wallets_linked,
      (SELECT COUNT(DISTINCT player_id) FROM wagers)::int                                        AS players_who_predicted,
      (SELECT COUNT(DISTINCT player_id) FROM wagers WHERE created_at > now() - interval '7 days')::int AS active_predictors_7d,
      (SELECT COUNT(*) FROM wagers)::int                                                         AS predictions_total,
      (SELECT COUNT(*) FROM markets WHERE status = 'open')::int                                  AS markets_open,
      (SELECT COUNT(*) FROM markets WHERE status = 'settled')::int                               AS markets_settled,
      (SELECT COUNT(*) FROM players WHERE referred_by IS NOT NULL)::int                          AS referred_players,
      (SELECT COUNT(*) FROM players WHERE referral_paid_at IS NOT NULL)::int                     AS referrals_rewarded,
      (SELECT COUNT(*) FROM players WHERE ghost_mode)::int                                       AS ghost_mode_players`);
  const { rows: byDay } = await pool.query(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS signups
     FROM players GROUP BY 1 ORDER BY 1 DESC LIMIT 14`);
  const { rows: byCountry } = await pool.query(
    `SELECT COALESCE(country, 'unknown') AS country, COUNT(*)::int AS players FROM players GROUP BY 1 ORDER BY 2 DESC LIMIT 10`);
  const r = rows[0];
  return {
    players: { total: r.players_total, last24h: r.players_last_24h, last7d: r.players_last_7d, withGoogle: r.signed_up_with_google, withWallet: r.wallets_linked, ghostMode: r.ghost_mode_players },
    activity: { playersWhoPredicted: r.players_who_predicted, activePredictors7d: r.active_predictors_7d, predictionsTotal: r.predictions_total },
    markets: { open: r.markets_open, settled: r.markets_settled },
    referrals: { referredPlayers: r.referred_players, rewarded: r.referrals_rewarded },
    signupsByDay: byDay, playersByCountry: byCountry,
  };
}

export async function listMarketsAdmin() {
  const { rows } = await pool.query(
    `SELECT m.id, m.title, m.status, m.model, m.created_at, (SELECT COUNT(*) FROM wagers w WHERE w.market_id = m.id)::int AS predictions
     FROM markets m ORDER BY m.created_at DESC LIMIT 20`);
  const { rows: outs } = rows.length
    ? await pool.query('SELECT market_id, id, label FROM outcomes WHERE market_id = ANY($1::uuid[]) ORDER BY sort', [rows.map((r) => r.id)])
    : { rows: [] };
  return rows.map((m) => ({
    id: m.id, title: m.title, status: m.status, model: m.model, createdAt: m.created_at, predictions: m.predictions,
    outcomes: outs.filter((o) => o.market_id === m.id).map((o) => ({ id: o.id, label: o.label })),
  }));
}
