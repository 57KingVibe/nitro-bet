import { Router } from 'express';
import { cacheMiddleware } from '../middleware/cache.js';

const router = Router();

router.get('/live', cacheMiddleware(15), async (req, res, next) => {
  try {
    const mockOdds = [
      {
        eventId: 'f1-monaco-2026',
        sport: 'Motorsport',
        market: 'Winner',
        outcomes: [
          { driver: 'Driver 1', odds: 2.10 },
          { driver: 'Driver 2', odds: 3.40 },
          { driver: 'Driver 3', odds: 5.00 },
        ],
        updatedAt: new Date().toISOString(),
      },
    ];

    return res.json({ success: true, data: mockOdds });
  } catch (err) {
    next(err);
  }
});

export default router;
