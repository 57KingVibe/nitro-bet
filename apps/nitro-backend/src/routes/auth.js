import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';
import { isAtLeastAge } from '../lib/age.js';
import { parse } from '../lib/validate.js';
import { requestCountry } from '../middleware/compliance.js';
import { registerPlayer, loginPlayer } from '../services/accounts.js';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, 'Use at least 10 characters').max(128),
  displayName: z.string().trim().min(2).max(30),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});
const LoginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });

router.post('/register', async (req, res, next) => {
  try {
    const body = parse(RegisterSchema, req.body);
    // Self-declared for now. Real age verification comes with the ID-check provider.
    if (!isAtLeastAge(body.dateOfBirth, env.MIN_AGE)) {
      throw new HttpError(403, `You must be at least ${env.MIN_AGE} years old.`, 'UNDERAGE');
    }
    res.status(201).json(await registerPlayer({ ...body, country: requestCountry(req) }));
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    res.json(await loginPlayer(parse(LoginSchema, req.body)));
  } catch (err) { next(err); }
});

export default router;
