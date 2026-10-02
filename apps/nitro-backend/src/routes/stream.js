import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { getUnifiedFeed } from '../services/openf1.js';

const router = Router();

// The UI polls this endpoint, so it gets its own, more generous limiter
// (the global 100-requests-per-15-minutes limit would block a polling client within minutes).
const streamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many telemetry requests, slow down.' },
});

router.get('/unified', streamLimiter, async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=5');
    return res.json(await getUnifiedFeed());
  } catch (err) {
    req.log?.error(err);
    return res.status(503).json({ error: 'Telemetry provider unavailable' });
  }
});

export default router;
