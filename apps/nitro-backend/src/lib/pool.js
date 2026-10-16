// Pool maths for Lite markets, in whole cents. Pure: no database, no env.
// Price of an outcome = its share of the pool = the market's implied probability.
// Opening "seed" points are counted like a phantom player's stake: they make the first prices sensible,
// and whatever the phantom would win is simply not paid out (so seeds never create new points).

export const INTERVALS_MS = { '5m': 300_000, '15m': 900_000, '1h': 3_600_000, '1d': 86_400_000 };

/** num/den in basis points (0..10000), rounded to nearest. */
export function toBp(num, den) {
  const d = BigInt(den);
  return d === 0n ? 0 : Number((BigInt(num) * 10000n + d / 2n) / d);
}

/** Opening pools proportional to 1/odds, adding up to exactly totalMinor (largest-remainder rounding). */
export function seedsFromOdds(oddsCentiList, totalMinor) {
  const weights = oddsCentiList.map((o) => 1 / o);
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (totalMinor * w) / sum);
  const seeds = raw.map(Math.floor);
  const left = totalMinor - seeds.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < left; k++) seeds[order[k][1]] += 1;
  return seeds;
}

/** outcomes: [{ id, seedMinor, stakedMinor }] -> pools, prices (basis points) and implied decimal odds. */
export function poolState(outcomes) {
  const totalMinor = outcomes.reduce((a, o) => a + o.seedMinor + o.stakedMinor, 0);
  return {
    totalMinor,
    outcomes: outcomes.map((o) => {
      const poolMinor = o.seedMinor + o.stakedMinor;
      // Stored odds must be above 1.00 (database rule), and are capped at 1000.
      const oddsCenti = poolMinor === 0 ? 100000 : Math.min(100000, Math.max(101, Math.round((totalMinor * 100) / poolMinor)));
      return { id: o.id, poolMinor, priceBp: toBp(poolMinor, totalMinor), oddsCenti };
    }),
  };
}

/** Estimated return (stake included) if this outcome wins and nobody stakes after you. The pool keeps moving. */
export function estimateReturnMinor(stakeMinor, outcomePoolMinor, totalMinor) {
  return Number((BigInt(stakeMinor) * BigInt(totalMinor + stakeMinor)) / BigInt(outcomePoolMinor + stakeMinor));
}

/**
 * wagers: [{ id, playerId, currency, outcomeId, stakeMinor }] (all open wagers of the market)
 * seeds: { [outcomeId]: seedMinor }
 * If nobody backed the winner, everything is refunded (voided = true).
 */
export function planPoolSettlement({ wagers, winningOutcomeId, seeds }) {
  const seedTotal = Object.values(seeds).reduce((a, b) => a + b, 0);
  const realTotal = wagers.reduce((a, w) => a + w.stakeMinor, 0);
  const winnersReal = wagers.filter((w) => w.outcomeId === winningOutcomeId).reduce((a, w) => a + w.stakeMinor, 0);
  if (winnersReal === 0) return { voided: true, items: [] };

  const pot = BigInt(realTotal + seedTotal);
  const winningPool = BigInt((seeds[winningOutcomeId] ?? 0) + winnersReal);
  const items = wagers.map((w) =>
    w.outcomeId === winningOutcomeId
      ? { wagerId: w.id, playerId: w.playerId, currency: w.currency, status: 'won', payoutMinor: Number((BigInt(w.stakeMinor) * pot) / winningPool) }
      : { wagerId: w.id, playerId: w.playerId, currency: w.currency, status: 'lost', payoutMinor: 0 }
  );
  return { voided: false, items };
}

/**
 * Candles of each outcome's price (basis points) as stakes arrive.
 * events: [{ t (ms), outcomeId, stakeMinor }] sorted by time. Buckets with no stakes are skipped.
 * Returns { candles: Map(outcomeId -> [{ t, o, h, l, c, v }]), pools: Map, totalMinor }.
 */
export function buildCandles({ outcomes, events, intervalMs }) {
  const pools = new Map(outcomes.map((o) => [o.id, o.seedMinor]));
  let total = outcomes.reduce((a, o) => a + o.seedMinor, 0);
  const priceOf = (id) => toBp(pools.get(id), total);
  const last = new Map(outcomes.map((o) => [o.id, priceOf(o.id)]));
  const candles = new Map(outcomes.map((o) => [o.id, []]));
  let bucket = null;
  let open = new Map();

  const flush = () => { for (const [id, c] of open) candles.get(id).push(c); open = new Map(); };

  for (const e of events) {
    if (!pools.has(e.outcomeId)) continue;
    const b = Math.floor(e.t / intervalMs) * intervalMs;
    if (bucket !== null && b !== bucket) flush();
    if (bucket !== b) {
      bucket = b;
      for (const o of outcomes) { const p = last.get(o.id); open.set(o.id, { t: b, o: p, h: p, l: p, c: p, v: 0 }); }
    }
    pools.set(e.outcomeId, pools.get(e.outcomeId) + e.stakeMinor);
    total += e.stakeMinor;
    for (const o of outcomes) {
      const p = priceOf(o.id); const c = open.get(o.id);
      c.h = Math.max(c.h, p); c.l = Math.min(c.l, p); c.c = p; last.set(o.id, p);
    }
    open.get(e.outcomeId).v += e.stakeMinor;
  }
  flush();
  return { candles, pools, totalMinor: total };
}
