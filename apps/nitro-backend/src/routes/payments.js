import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../config/db.js';

const router = Router();

// SECURITY TODO: `lostAmount` comes from the client, so any logged-in user could claim cashback on a loss that never
// happened. Before this goes live, compute the amount server-side from settled bets in the `bets` table.
// (Nothing issues JWTs yet, so this route is currently unreachable.)

const CashbackSchema = z.object({
  userWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM wallet address"),
  lostAmount: z.number().positive("Amount must be greater than zero"),
});

router.post('/cashback', requireAuth, async (req, res, next) => {
  try {
    const parseResult = CashbackSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: parseResult.error.issues,
      });
    }

    const { userWallet, lostAmount } = parseResult.data;

    if (req.user.walletAddress?.toLowerCase() !== userWallet.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized: Wallet payload mismatch.' });
    }

    const cashbackAmount = lostAmount * 0.20;

    const query = `
      INSERT INTO transactions (user_id, type, amount, status)
      VALUES ($1, 'CASHBACK', $2, 'PENDING')
      RETURNING id, amount, status, created_at;
    `;
    const values = [req.user.id, cashbackAmount];
    const { rows } = await pool.query(query, values);

    return res.json({
      success: true,
      cashback: rows[0],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
