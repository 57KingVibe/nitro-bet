import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// scrypt ships with Node, so there is no native dependency to compile on Render.
// N=2^15, r=8 uses ~32 MiB per hash; the auth routes are rate limited because of that.
const scrypt = promisify(scryptCb);
const N = 32768, R = 8, P = 1, KEYLEN = 64, MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every(Number.isInteger)) return false;
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  const key = await scrypt(password, salt, expected.length, { N: n, r, p, maxmem: MAXMEM });
  return timingSafeEqual(key, expected);
}
