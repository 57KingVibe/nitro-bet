import { env } from '../config/env.js';
import { evaluateGeo, parseCountryList } from '../lib/geo.js';
import { HttpError } from '../lib/http-error.js';

const blocked = parseCountryList(env.BLOCKED_COUNTRIES);
// In real-money production, a request whose country we cannot determine is refused.
const failClosed = env.REAL_MONEY_ENABLED === 'true' && env.NODE_ENV === 'production';

export const requestCountry = (req) => String(req.headers['cf-ipcountry'] ?? '').toUpperCase() || null;

/** Refuses requests from blocked countries (451). Render sits behind Cloudflare, which sets CF-IPCountry. */
export const geoBlock = (req, res, next) => {
  const verdict = evaluateGeo({ country: requestCountry(req), blocked, failClosed });
  if (!verdict.allowed) {
    return next(new HttpError(451, 'This service is not available in your region.', verdict.reason));
  }
  next();
};
