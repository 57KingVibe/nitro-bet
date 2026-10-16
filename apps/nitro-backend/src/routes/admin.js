import { Router } from 'express';
import { z } from 'zod';
import { withTx } from '../db/tx.js';
import { HttpError } from '../lib/http-error.js';
import { env } from '../config/env.js';
import { oddsToCenti, parseMoneyToMinor } from '../lib/money.js';
import { seedsFromOdds } from '../lib/pool.js';
import { parse } from '../lib/validate.js';
import { requireAdminKey } from '../middleware/adminKey.js';
import { settleMarket, voidMarket, closeMarket } from '../services/betting.js';

const router = Router();
router.use(requireAdminKey);

const CreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  sport: z.string().trim().min(2).max(20).default('F1'),
  closesAt: z.string().datetime().optional(),
  model: z.enum(['pool', 'fixed']).default('pool'),
  seedPoints: z.union([z.string(), z.number()]).optional(),   // opening house points for a pool market, e.g. 1000
  outcomes: z.array(z.object({ label: z.string().trim().min(1).max(60), odds: z.union([z.string(), z.number()]) })).min(2).max(30),
});

router.post('/markets', async (req, res, next) => {
  try {
    const body = parse(CreateSchema, req.body);
    const outcomes = body.outcomes.map((o) => {
      const odds = oddsToCenti(o.odds);
      if (odds === null) throw new HttpError(400, `Bad odds for "${o.label}". Use 1.01 to 1000 with at most 2 decimals.`, 'BAD_ODDS');
      return { label: o.label, odds };
    });
    let seeds = outcomes.map(() => 0);
    if (body.model === 'pool') {
      const total = body.seedPoints != null ? parseMoneyToMinor(body.seedPoints) : env.LITE_POOL_SEED_MINOR;
      if (total === null || total < 1000) throw new HttpError(400, 'seedPoints must be at least 10 and have at most 2 decimals.', 'BAD_SEED');
      seeds = seedsFromOdds(outcomes.map((o) => o.odds), total);   // the odds you enter set the opening prices
    }
    const market = await withTx(async (client) => {
      const { rows } = await client.query(
        'INSERT INTO markets (sport, title, closes_at, model) VALUES ($1,$2,$3,$4) RETURNING id, title, status, model',
        [body.sport, body.title, body.closesAt ?? null, body.model]);
      for (const [i, o] of outcomes.entries()) {
        await client.query('INSERT INTO outcomes (market_id, label, odds_centi, seed_minor, sort) VALUES ($1,$2,$3,$4,$5)', [rows[0].id, o.label, o.odds, seeds[i], i]);
      }
      await client.query('INSERT INTO audit_log (actor, action, details) VALUES ($1,$2,$3)',
        [req.actor, 'market.create', JSON.stringify({ marketId: rows[0].id, title: body.title })]);
      return rows[0];
    });
    res.status(201).json({ market });
  } catch (err) { next(err); }
});

const IdSchema = z.object({ id: z.string().uuid() });
router.post('/markets/:id/close', async (req, res, next) => {
  try { res.json(await closeMarket({ marketId: parse(IdSchema, req.params).id, actor: req.actor })); } catch (err) { next(err); }
});
router.post('/markets/:id/void', async (req, res, next) => {
  try { res.json(await voidMarket({ marketId: parse(IdSchema, req.params).id, actor: req.actor })); } catch (err) { next(err); }
});
router.post('/markets/:id/settle', async (req, res, next) => {
  try {
    const { id } = parse(IdSchema, req.params);
    const { winningOutcomeId } = parse(z.object({ winningOutcomeId: z.string().uuid() }), req.body);
    res.json(await settleMarket({ marketId: id, winningOutcomeId, actor: req.actor }));
  } catch (err) { next(err); }
});

export default router;
