import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L, easy to read out loud
export const REF_PATTERN = /^[A-Z2-9]{8}$/;

export const generateReferralCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** Accepts what a person might paste (lowercase, spaces) and returns a valid code or null. */
export function normalizeRef(input) {
  const code = String(input ?? '').trim().toUpperCase();
  return REF_PATTERN.test(code) ? code : null;
}
