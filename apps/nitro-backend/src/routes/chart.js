import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { HttpError } from '../lib/http-error.js';
import { formatMinor } from '../lib/money.js';
import { parse } from '../lib/validate.js';
import { INTERVALS_MS, buildCandles, toBp } from '../lib/pool.js';

const router = Router();

// The chart is polled, so it has its own limiter (mounted before the global one, like the telemetry route).
const chartLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many chart requests, slow down.' } });

const Params = z.object({ id: z.string().uuid() });
const Query = z.object({ interval: z.enum(['5m', '15m', '1h', '1d']).default('15m') });

router.get('/:id/chart', chartLimiter, async (req, res, next) => {
  try {
    const { id } = parse(Params, req.params);
    const { interval } = parse(Query, req.query);
    const { rows: m } = await pool.query('SELECT id, model, status FROM markets WHERE id = $1', [id]);
    if (!m[0]) throw new HttpError(404, 'Market not found.', 'MARKET_NOT_FOUND');
    if (m[0].model !== 'pool') return res.json({ marketId: id, model: m[0].model, interval, totalMinor: 0, total: '0.00', outcomes: [] });

    const { rows: o } = await pool.query('SELECT id, label, seed_minor FROM outcomes WHERE market_id = $1 ORDER BY sort ASC', [id]);
    const { rows: ev } = await pool.query(
      `SELECT outcome_id, stake_minor::bigint AS stake_minor, (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS t
       FROM wagers WHERE market_id = $1 AND status <> 'void' ORDER BY created_at ASC, id ASC LIMIT 5000`, [id]);

    const outcomes = o.map((r) => ({ id: r.id, label: r.label, seedMinor: Number(r.seed_minor) }));
    const events = ev.map((r) => ({ t: Number(r.t), outcomeId: r.outcome_id, stakeMinor: Number(r.stake_minor) }));
    const built = buildCandles({ outcomes, events, intervalMs: INTERVALS_MS[interval] });

    res.set('Cache-Control', 'public, max-age=5');
    res.json({
      marketId: id, model: 'pool', interval, status: m[0].status,
      totalMinor: built.totalMinor, total: formatMinor(built.totalMinor),
      outcomes: outcomes.map((x) => ({
        id: x.id, label: x.label, poolMinor: built.pools.get(x.id), priceBp: toBp(built.pools.get(x.id), built.totalMinor),
        candles: built.candles.get(x.id),
      })),
    });
  } catch (err) { next(err); }
});

export default router;
