import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../config/db.js';
import { HttpError } from '../lib/http-error.js';
import { parseMoneyToMinor, oddsToCenti, formatMinor } from '../lib/money.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { placeWager, listWagers } from '../services/betting.js';

const router = Router();
router.use(requireAuth);

// Per player, not per IP: many phones share one carrier IP.
const betLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  message: { error: 'Too many bets, slow down.' },
});

const PlaceSchema = z.object({
  outcomeId: z.string().uuid(),
  stake: z.union([z.string(), z.number()]),
  acceptedOdds: z.union([z.string(), z.number()]).optional(),
  idempotencyKey: z.string().min(8).max(100).optional(),
});

router.post('/', betLimiter, async (req, res, next) => {
  try {
    const body = parse(PlaceSchema, req.body);
    const stakeMinor = parseMoneyToMinor(body.stake);
    if (stakeMinor === null) throw new HttpError(400, 'Stake must be an amount with at most 2 decimals.', 'BAD_STAKE');
    let acceptedOddsCenti;
    if (body.acceptedOdds !== undefined) {
      acceptedOddsCenti = oddsToCenti(body.acceptedOdds);
      if (acceptedOddsCenti === null) throw new HttpError(400, 'acceptedOdds is not valid.', 'BAD_ODDS');
    }
    const result = await placeWager({
      playerId: req.user.id, outcomeId: body.outcomeId, stakeMinor, acceptedOddsCenti, idempotencyKey: body.idempotencyKey,
    });
    res.status(result.replayed ? 200 : 201).json({
      wager: result.wager, balanceMinor: result.balanceMinor, balance: formatMinor(result.balanceMinor), replayed: result.replayed,
    });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try { res.json({ wagers: await listWagers(pool, req.user.id) }); } catch (err) { next(err); }
});

export default router;
