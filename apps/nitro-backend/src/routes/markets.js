import { Router } from 'express';
import { pool } from '../config/db.js';
import { centiToOdds } from '../lib/money.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id AS market_id, m.title, m.sport, m.status, m.closes_at,
              o.id AS outcome_id, o.label, o.odds_centi
       FROM markets m JOIN outcomes o ON o.market_id = m.id
       WHERE m.status = 'open'
       ORDER BY m.created_at DESC, o.sort ASC`);
    const byMarket = new Map();
    for (const r of rows) {
      if (!byMarket.has(r.market_id)) {
        byMarket.set(r.market_id, { id: r.market_id, title: r.title, sport: r.sport, status: r.status, closesAt: r.closes_at, outcomes: [] });
      }
      byMarket.get(r.market_id).outcomes.push({ id: r.outcome_id, label: r.label, odds: centiToOdds(r.odds_centi), oddsCenti: r.odds_centi });
    }
    res.json({ markets: [...byMarket.values()] });
  } catch (err) { next(err); }
});

export default router;
