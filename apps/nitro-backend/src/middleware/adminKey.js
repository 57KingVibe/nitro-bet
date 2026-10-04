import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';

const digest = (s) => createHash('sha256').update(String(s)).digest();

/** Admin routes need the X-Admin-Key header. With no ADMIN_API_KEY configured they are switched off. */
export const requireAdminKey = (req, res, next) => {
  if (!env.ADMIN_API_KEY) return next(new HttpError(503, 'Admin API is not configured.', 'ADMIN_DISABLED'));
  const supplied = req.headers['x-admin-key'];
  if (typeof supplied !== 'string' || !timingSafeEqual(digest(supplied), digest(env.ADMIN_API_KEY))) {
    return next(new HttpError(401, 'Invalid admin key.', 'BAD_ADMIN_KEY'));
  }
  req.actor = 'admin';
  next();
};
