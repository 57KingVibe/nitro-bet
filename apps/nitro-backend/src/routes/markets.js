import { Router } from 'express';
import { pool } from '../config/db.js';
import { centiToOdds } from '../lib/money.js';
import { poolState } from '../lib/pool.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id AS market_id, m.title, m.sport, m.status, m.closes_at, m.model,
              o.id AS outcome_id, o.label, o.odds_centi, o.seed_minor,
              COALESCE(SUM(w.stake_minor) FILTER (WHERE w.status <> 'void'), 0)::bigint AS staked_minor
       FROM markets m JOIN outcomes o ON o.market_id = m.id
       LEFT JOIN wagers w ON w.outcome_id = o.id
       WHERE m.status = 'open'
       GROUP BY m.id, o.id
       ORDER BY m.created_at DESC, o.sort ASC`);

    const byMarket = new Map();
    for (const r of rows) {
      if (!byMarket.has(r.market_id)) {
        byMarket.set(r.market_id, { id: r.market_id, title: r.title, sport: r.sport, status: r.status, closesAt: r.closes_at, model: r.model, rows: [] });
      }
      byMarket.get(r.market_id).rows.push(r);
    }

    const markets = [...byMarket.values()].map(({ rows: rs, ...m }) => {
      if (m.model !== 'pool') {
        return { ...m, outcomes: rs.map((r) => ({ id: r.outcome_id, label: r.label, odds: centiToOdds(r.odds_centi), oddsCenti: r.odds_centi })) };
      }
      const state = poolState(rs.map((r) => ({ id: r.outcome_id, seedMinor: Number(r.seed_minor), stakedMinor: Number(r.staked_minor) })));
      return {
        ...m, poolTotalMinor: state.totalMinor,
        outcomes: rs.map((r, i) => {
          const s = state.outcomes[i];
          return { id: r.outcome_id, label: r.label, odds: centiToOdds(s.oddsCenti), oddsCenti: s.oddsCenti, priceBp: s.priceBp, poolMinor: s.poolMinor };
        }),
      };
    });
    res.json({ markets });
  } catch (err) { next(err); }
});

export default router;
