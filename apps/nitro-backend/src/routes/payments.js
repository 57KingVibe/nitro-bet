import { Router } from 'express';

const router = Router();

// DISABLED on purpose. The old version trusted a client-supplied `lostAmount`, so any player could claim
// cashback on losses that never happened. Re-enable only after it is computed server-side from settled
// wagers, with per-player caps and one-account-per-person KYC (otherwise two accounts betting opposite sides
// can farm it). Deposits and withdrawals are not built yet either.
router.post('/cashback', (req, res) => {
  res.status(501).json({ error: 'NotImplemented', message: 'Cashback is not available yet.' });
});

export default router;
