// Money is ALWAYS an integer number of minor units (cents). Never use floats for balances.
// Odds are stored in hundredths: 1.59 -> 159.

/** "12.50" or 12.5 -> 1250. Returns null for anything that is not a plain amount with at most 2 decimals. */
export function parseMoneyToMinor(input) {
  const s = typeof input === 'number' ? String(input) : input;
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function formatMinor(minor) {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** 1.59 -> 159. Returns null unless the odds are between 1.01 and 1000 with at most 2 decimals. */
export function oddsToCenti(input) {
  const s = typeof input === 'number' ? String(input) : input;
  if (typeof s !== 'string' || !/^\d{1,4}(\.\d{1,2})?$/.test(s.trim())) return null;
  const centi = Math.round(Number(s.trim()) * 100);
  return centi >= 101 && centi <= 100000 ? centi : null;
}

export const centiToOdds = (centi) => (centi / 100).toFixed(2);

/** Total payout (stake included), rounded DOWN to the cent. BigInt avoids float error. */
export function payoutMinor(stakeMinor, oddsCenti) {
  return Number((BigInt(stakeMinor) * BigInt(oddsCenti)) / 100n);
}
