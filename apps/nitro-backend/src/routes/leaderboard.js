import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { getLeaderboard, getMyRank } from '../services/leaderboard.js';

const router = Router();
const Query = z.object({ period: z.enum(['week', 'all']).default('week') });

// Public: names only (ghost players are masked), never emails or ids.
router.get('/', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=15');
    res.json(await getLeaderboard(parse(Query, req.query)));
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try { res.json(await getMyRank(req.user.id, parse(Query, req.query).period)); } catch (err) { next(err); }
});

export default router;
