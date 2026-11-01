import { createPublicKey, createVerify } from 'node:crypto';
import { HttpError } from './http-error.js';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let cache = { at: 0, keys: [] };

async function fetchGoogleKeys() {
  if (cache.keys.length && Date.now() - cache.at < 3_600_000) return cache.keys;
  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Google keys responded ${res.status}`);
  cache = { at: Date.now(), keys: (await res.json()).keys ?? [] };
  return cache.keys;
}

const bad = () => new HttpError(401, 'Google sign-in could not be verified. Please try again.', 'BAD_GOOGLE_TOKEN');
const part = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

/** Checks Google's signature, audience, issuer, expiry and that the email is verified. */
export async function verifyGoogleIdToken(idToken, { clientId, now = Date.now(), getKeys = fetchGoogleKeys }) {
  try {
    const parts = String(idToken).split('.');
    if (parts.length !== 3) throw bad();
    const header = part(parts[0]);
    const payload = part(parts[1]);
    if (header.alg !== 'RS256') throw bad();
    const jwk = (await getKeys()).find((k) => k.kid === header.kid);
    if (!jwk) throw bad();
    const valid = createVerify('RSA-SHA256').update(`${parts[0]}.${parts[1]}`).verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
    if (!valid) throw bad();
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) throw bad();
    if (!clientId || payload.aud !== clientId) throw bad();
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < now - 60_000) throw bad();
    if (!payload.sub || !payload.email || !(payload.email_verified === true || payload.email_verified === 'true')) throw bad();
    return { sub: String(payload.sub), email: String(payload.email).toLowerCase(), name: payload.name ? String(payload.name) : '' };
  } catch (err) {
    throw err instanceof HttpError ? err : bad();
  }
}
