// Reference model of the contract's payout math, checked with random inputs (runs with plain Node, no tools needed).
// It mirrors _payout() and feeOf() in NitroBetMarket.sol, so it checks the maths but NOT the Solidity itself.
import test from 'node:test';
import assert from 'node:assert/strict';

const rnd = (min, max) => BigInt(Math.floor(min + Math.random() * (max - min + 1)));

function settle(stakes, winning, feeBps) {
  // stakes: [{ who, outcome, amount }] as BigInt token units
  const total = stakes.reduce((a, s) => a + s.amount, 0n);
  const winPool = stakes.filter((s) => s.outcome === winning).reduce((a, s) => a + s.amount, 0n);
  if (winPool === 0n) return { void: true, payouts: new Map(stakes.map((s) => [s.who, s.amount])), fee: 0n, total };
  const loserPool = total - winPool;
  const fee = (loserPool * feeBps) / 10_000n;
  const net = loserPool - fee;
  const payouts = new Map();
  for (const s of stakes.filter((x) => x.outcome === winning)) {
    payouts.set(s.who, (payouts.get(s.who) ?? 0n) + s.amount + (net * s.amount) / winPool);
  }
  return { void: false, payouts, fee, total, winPool, winners: payouts.size };
}

test('worked example from the tests: 100 + 300 win, 200 lose, 5% fee', () => {
  const r = settle([{ who: 'a', outcome: 0, amount: 100_000_000n }, { who: 'b', outcome: 0, amount: 300_000_000n }, { who: 'c', outcome: 1, amount: 200_000_000n }], 0, 500n);
  assert.equal(r.payouts.get('a'), 147_500_000n);
  assert.equal(r.payouts.get('b'), 442_500_000n);
  assert.equal(r.fee, 10_000_000n);
});

test('random markets: nothing created, winners keep their stake, dust is at most 1 unit per winner', () => {
  for (let i = 0; i < 20_000; i++) {
    const n = Number(rnd(2, 12));
    const stakes = Array.from({ length: n }, (_, k) => ({ who: `p${k}`, outcome: Number(rnd(0, 3)), amount: rnd(1_000_000, 500_000_000) }));
    const winning = Number(rnd(0, 3));
    const feeBps = rnd(0, 1000);
    const r = settle(stakes, winning, feeBps);
    const paid = [...r.payouts.values()].reduce((a, b) => a + b, 0n);
    if (r.void) { assert.equal(paid, r.total); continue; }
    assert.ok(paid + r.fee <= r.total, 'payouts + fee must not exceed the pool');
    assert.ok(r.total - paid - r.fee <= BigInt(r.winners), 'dust must be at most one unit per winner');
    for (const s of stakes.filter((x) => x.outcome === winning)) assert.ok(r.payouts.get(s.who) >= s.amount, 'winner lost money');
    assert.ok(r.fee <= (r.total - r.winPool) / 10n, 'fee above 10% of the losing side');
  }
});
