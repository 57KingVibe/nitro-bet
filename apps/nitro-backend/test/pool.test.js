import test from 'node:test';
import assert from 'node:assert/strict';
import { toBp, seedsFromOdds, poolState, estimateReturnMinor, planPoolSettlement, buildCandles } from '../src/lib/pool.js';

test('seedsFromOdds adds up exactly and favours short odds', () => {
  const s = seedsFromOdds([159, 356, 562, 808, 1225], 100000);
  assert.equal(s.reduce((a, b) => a + b, 0), 100000);
  assert.ok(s[0] > s[1] && s[1] > s[2] && s[2] > s[3] && s[3] > s[4]);
  assert.equal(seedsFromOdds([200, 200, 200], 100).reduce((a, b) => a + b, 0), 100);   // remainder is shared out
});

test('poolState: prices add to about 100% and odds follow the pool share', () => {
  const st = poolState([{ id: 'a', seedMinor: 600, stakedMinor: 0 }, { id: 'b', seedMinor: 400, stakedMinor: 0 }]);
  assert.equal(st.totalMinor, 1000);
  assert.deepEqual(st.outcomes.map((o) => o.priceBp), [6000, 4000]);
  assert.deepEqual(st.outcomes.map((o) => o.oddsCenti), [167, 250]);
  const heavy = poolState([{ id: 'a', seedMinor: 1, stakedMinor: 100000 }, { id: 'b', seedMinor: 1, stakedMinor: 0 }]);
  assert.ok(heavy.outcomes[0].oddsCenti >= 101);                 // never at or below 1.00 (database rule)
  assert.equal(poolState([{ id: 'z', seedMinor: 0, stakedMinor: 0 }]).outcomes[0].oddsCenti, 100000);
});

test('estimateReturnMinor includes the stake itself moving the pool', () => {
  assert.equal(estimateReturnMinor(100, 200, 1000), 366);        // 100 * 1100 / 300, rounded down
  assert.ok(estimateReturnMinor(100, 200, 1000) < Math.floor(100 * 1000 / 200));
});

const W = (id, playerId, outcomeId, stakeMinor) => ({ id, playerId, currency: 'PLAY', outcomeId, stakeMinor });

test('pool settlement: winners share the whole pot, nothing is created', () => {
  const wagers = [W('1', 'p1', 'a', 100), W('2', 'p2', 'a', 300), W('3', 'p3', 'b', 600)];
  const { voided, items } = planPoolSettlement({ wagers, winningOutcomeId: 'a', seeds: { a: 100, b: 100 } });
  assert.equal(voided, false);
  const pot = 1000 + 200, winningPool = 100 + 400;
  assert.equal(items[0].payoutMinor, Math.floor((100 * pot) / winningPool));   // 240
  assert.equal(items[1].payoutMinor, Math.floor((300 * pot) / winningPool));   // 720
  assert.equal(items[2].status, 'lost');
  assert.ok(items.reduce((a, i) => a + i.payoutMinor, 0) <= pot);
});

test('pool settlement: if nobody backed the winner, the market is voided for refunds', () => {
  const r = planPoolSettlement({ wagers: [W('1', 'p1', 'b', 500)], winningOutcomeId: 'a', seeds: { a: 100, b: 100 } });
  assert.equal(r.voided, true);
  assert.deepEqual(r.items, []);
});

test('pool settlement never pays more than the pot (random cases)', () => {
  let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (let n = 0; n < 300; n++) {
    const outs = ['a', 'b', 'c', 'd'];
    const seeds = Object.fromEntries(outs.map((o) => [o, Math.floor(rnd() * 5000)]));
    const wagers = Array.from({ length: 1 + Math.floor(rnd() * 12) }, (_, i) => W(String(i), `p${i}`, outs[Math.floor(rnd() * 4)], 100 + Math.floor(rnd() * 50000)));
    const win = outs[Math.floor(rnd() * 4)];
    const r = planPoolSettlement({ wagers, winningOutcomeId: win, seeds });
    const pot = wagers.reduce((a, w) => a + w.stakeMinor, 0) + Object.values(seeds).reduce((a, b) => a + b, 0);
    if (r.voided) { assert.ok(!wagers.some((w) => w.outcomeId === win)); continue; }
    assert.ok(r.items.reduce((a, i) => a + i.payoutMinor, 0) <= pot);
  }
});

test('buildCandles: open, high, low, close and volume per outcome', () => {
  const outcomes = [{ id: 'a', seedMinor: 500 }, { id: 'b', seedMinor: 500 }];
  const events = [
    { t: 1000, outcomeId: 'a', stakeMinor: 500 },    // a: 1000/1500 = 66.67%
    { t: 2000, outcomeId: 'b', stakeMinor: 1000 },   // a: 1000/2500 = 40%
    { t: 70000, outcomeId: 'a', stakeMinor: 500 },   // next minute bucket
  ];
  const { candles, totalMinor } = buildCandles({ outcomes, events, intervalMs: 60000 });
  assert.equal(totalMinor, 3000);
  const a = candles.get('a');
  assert.equal(a.length, 2);
  assert.deepEqual(a[0], { t: 0, o: 5000, h: 6667, l: 4000, c: 4000, v: 500 });
  assert.equal(a[1].o, 4000);                          // opens where the last candle closed
  assert.equal(a[1].c, 5000);                          // a's pool 1500 of 3000 = 50.00%
  assert.equal(a[1].v, 500);
});

test('buildCandles with no stakes gives no candles and keeps the opening prices', () => {
  const { candles, pools } = buildCandles({ outcomes: [{ id: 'a', seedMinor: 300 }, { id: 'b', seedMinor: 700 }], events: [], intervalMs: 900000 });
  assert.deepEqual(candles.get('a'), []);
  assert.equal(pools.get('b'), 700);
});

test('toBp rounds to the nearest basis point', () => {
  assert.equal(toBp(1, 3), 3333);
  assert.equal(toBp(2, 3), 6667);
  assert.equal(toBp(5, 0), 0);
});
