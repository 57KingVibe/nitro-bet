import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoneyToMinor, formatMinor, oddsToCenti, payoutMinor, centiToOdds } from '../src/lib/money.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { isAtLeastAge } from '../src/lib/age.js';
import { evaluateGeo, parseCountryList } from '../src/lib/geo.js';
import { validateWager, planSettlement, planVoid, assertRealMoneyReady } from '../src/lib/betting-rules.js';

test('money parsing is strict and exact', () => {
  assert.equal(parseMoneyToMinor('12.50'), 1250);
  assert.equal(parseMoneyToMinor(12.5), 1250);
  assert.equal(parseMoneyToMinor('0.05'), 5);
  assert.equal(parseMoneyToMinor('7'), 700);
  for (const bad of ['', '-1', '1.234', '1e3', 'abc', 0.1 + 0.2, null, undefined, '1,000', '9999999999']) {
    assert.equal(parseMoneyToMinor(bad), null, `should reject ${String(bad)}`);
  }
  assert.equal(formatMinor(1250), '12.50');
  assert.equal(formatMinor(-5), '-0.05');
});

test('odds parsing and payout rounding (always down, never float)', () => {
  assert.equal(oddsToCenti('1.59'), 159);
  assert.equal(oddsToCenti(3.5), 350);
  for (const bad of ['1', '1.00', '1.005', '0.5', '2000', 'x']) assert.equal(oddsToCenti(bad), null, bad);
  assert.equal(payoutMinor(10000, 159), 15900);
  assert.equal(payoutMinor(333, 159), 529); // 333 * 1.59 = 529.47 -> 529
  assert.equal(payoutMinor(1, 101), 1);     // 1.01 -> floor
  assert.equal(centiToOdds(159), '1.59');
});

test('passwords: hash differs per call, verify accepts only the right one, junk hashes fail safe', async () => {
  const a = await hashPassword('correct horse battery');
  const b = await hashPassword('correct horse battery');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('correct horse battery', a), true);
  assert.equal(await verifyPassword('wrong password!!', a), false);
  assert.equal(await verifyPassword('x', 'not-a-hash'), false);
  assert.equal(await verifyPassword('x', undefined), false);
});

test('age check', () => {
  const now = new Date('2026-10-04T12:00:00Z');
  assert.equal(isAtLeastAge('2008-10-04', 18, now), true);   // turns 18 today
  assert.equal(isAtLeastAge('2008-10-05', 18, now), false);  // tomorrow
  assert.equal(isAtLeastAge('1990-01-01', 18, now), true);
  assert.equal(isAtLeastAge('2001-02-31', 18, now), false);  // impossible date
  assert.equal(isAtLeastAge('2030-01-01', 18, now), false);  // future
  assert.equal(isAtLeastAge('1800-01-01', 18, now), false);
  assert.equal(isAtLeastAge('not-a-date', 18, now), false);
  assert.equal(isAtLeastAge(undefined, 18, now), false);
});

test('geo gate', () => {
  const blocked = parseCountryList(' us, gb ,,');
  assert.deepEqual([...blocked].sort(), ['GB', 'US']);
  assert.equal(evaluateGeo({ country: 'us', blocked, failClosed: false }).allowed, false);
  assert.equal(evaluateGeo({ country: 'NG', blocked, failClosed: false }).allowed, true);
  assert.equal(evaluateGeo({ country: undefined, blocked, failClosed: false }).allowed, true);
  assert.equal(evaluateGeo({ country: undefined, blocked, failClosed: true }).allowed, false);
  assert.equal(evaluateGeo({ country: 'T1', blocked, failClosed: true }).reason, 'UNKNOWN_COUNTRY');
});

const base = () => ({
  row: { status: 'open', closes_at: null, odds_centi: 159 },
  stakeMinor: 1000, balanceMinor: 5000, acceptedOddsCenti: 159,
  now: new Date('2026-10-04T12:00:00Z'), minStakeMinor: 100, maxStakeMinor: 50000, excludedUntil: null,
});
const code = (fn) => { try { fn(); return 'OK'; } catch (e) { return e.code; } };

test('wager validation refuses everything it should', () => {
  assert.deepEqual(validateWager(base()), { oddsCenti: 159, potentialPayoutMinor: 1590 });
  assert.equal(code(() => validateWager({ ...base(), row: undefined })), 'OUTCOME_NOT_FOUND');
  assert.equal(code(() => validateWager({ ...base(), row: { ...base().row, status: 'closed' } })), 'MARKET_CLOSED');
  assert.equal(code(() => validateWager({ ...base(), row: { ...base().row, closes_at: '2026-10-04T11:00:00Z' } })), 'MARKET_CLOSED');
  assert.equal(code(() => validateWager({ ...base(), stakeMinor: 50 })), 'STAKE_TOO_LOW');
  assert.equal(code(() => validateWager({ ...base(), stakeMinor: 50001, balanceMinor: 99999 })), 'STAKE_TOO_HIGH');
  assert.equal(code(() => validateWager({ ...base(), balanceMinor: 999 })), 'INSUFFICIENT_FUNDS');
  assert.equal(code(() => validateWager({ ...base(), excludedUntil: '2026-12-01T00:00:00Z' })), 'SELF_EXCLUDED');
  assert.equal(code(() => validateWager({ ...base(), excludedUntil: '2026-01-01T00:00:00Z' })), 'OK');
});

test('odds drift: worse is refused, better is accepted at the better price', () => {
  assert.equal(code(() => validateWager({ ...base(), acceptedOddsCenti: 170 })), 'ODDS_CHANGED');
  const better = validateWager({ ...base(), acceptedOddsCenti: 150 });
  assert.equal(better.oddsCenti, 159);
  assert.equal(validateWager({ ...base(), acceptedOddsCenti: undefined }).oddsCenti, 159);
});

test('settlement pays winners, zeroes losers, and money in = money out', () => {
  const wagers = [
    { id: 'a', playerId: 'p1', currency: 'PLAY', outcomeId: 'o1', stakeMinor: 1000, oddsCenti: 159 },
    { id: 'b', playerId: 'p2', currency: 'PLAY', outcomeId: 'o2', stakeMinor: 2000, oddsCenti: 350 },
    { id: 'c', playerId: 'p3', currency: 'PLAY', outcomeId: 'o1', stakeMinor: 333, oddsCenti: 159 },
  ];
  const plan = planSettlement(wagers, 'o1');
  assert.deepEqual(plan.map((p) => [p.wagerId, p.status, p.payoutMinor]), [['a', 'won', 1590], ['b', 'lost', 0], ['c', 'won', 529]]);
  assert.deepEqual(planVoid(wagers).map((r) => r.refundMinor), [1000, 2000, 333]);
});

test('real-money mode refuses bets until KYC and payments exist', () => {
  assert.equal(code(() => assertRealMoneyReady(false)), 'OK');
  assert.equal(code(() => assertRealMoneyReady(true)), 'REAL_MONEY_NOT_READY');
  assert.equal(code(() => assertRealMoneyReady(true, true)), 'OK');
});
