import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { getProfile, selfExclude, updateSettings } from '../services/accounts.js';
import { listLedger } from '../services/wallet.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try { res.json(await getProfile(req.user.id)); } catch (err) { next(err); }
});

router.get('/ledger', async (req, res, next) => {
  try { res.json({ entries: await listLedger(pool, req.user.id) }); } catch (err) { next(err); }
});

const ExcludeSchema = z.object({ days: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90), z.literal(180), z.literal(365)]) });
router.post('/self-exclude', async (req, res, next) => {
  try { res.json(await selfExclude(req.user.id, parse(ExcludeSchema, req.body).days)); } catch (err) { next(err); }
});

const SettingsSchema = z.object({ ghostMode: z.boolean() });
router.patch('/settings', async (req, res, next) => {
  try { res.json(await updateSettings(req.user.id, parse(SettingsSchema, req.body))); } catch (err) { next(err); }
});

export default router;
