import test from 'node:test';
import assert from 'node:assert/strict';
import { normName, matchOutcome, pickRace, racePhase, findWinner, createAutoSettler } from '../src/lib/autosettle.js';

const OUTS = [
  { id: 'o1', label: 'Max Verstappen' }, { id: 'o2', label: 'Lando Norris' },
  { id: 'o3', label: 'Charles Leclerc' }, { id: 'o4', label: 'Kimi Antonelli' },
];
const T = (iso) => Date.parse(iso);
const RACE = { session_key: 9001, session_name: 'Race', date_start: '2026-11-08T14:00:00+00:00', date_end: '2026-11-08T16:00:00+00:00' };
const SPRINT = { session_key: 9000, session_name: 'Sprint', date_start: '2026-11-07T10:00:00+00:00', date_end: '2026-11-07T10:30:00+00:00' };
const DELAY = 120 * 60_000;

test('normName drops accents, case and punctuation', () => {
  assert.equal(normName('Andrea Kimi ANTONELLI'), 'andrea kimi antonelli');
  assert.equal(normName("  Sergio  Pérez "), 'sergio perez');
  assert.equal(normName(null), '');
});

test('matchOutcome: exact name, then a unique surname, never a guess', () => {
  assert.equal(matchOutcome('Max VERSTAPPEN', OUTS).id, 'o1');
  assert.equal(matchOutcome('Andrea Kimi ANTONELLI', OUTS).id, 'o4');          // surname fallback
  assert.equal(matchOutcome('Lewis HAMILTON', OUTS), null);                    // not an outcome
  assert.equal(matchOutcome('', OUTS), null);
  const twins = [{ id: 'a', label: 'Kevin Magnussen' }, { id: 'b', label: 'Jan Magnussen' }];
  assert.equal(matchOutcome('Peter MAGNUSSEN', twins), null);                  // two surname matches: refuse
  assert.equal(matchOutcome('Kevin MAGNUSSEN', twins).id, 'a');                // exact wins
});

test('pickRace: first Race that ends after the market was created, Sprints ignored', () => {
  const earlier = { ...RACE, session_key: 8001, date_start: '2026-11-01T14:00:00+00:00', date_end: '2026-11-01T16:00:00+00:00' };
  const sessions = [RACE, SPRINT, earlier];
  assert.equal(pickRace(sessions, T('2026-10-30T00:00:00Z')).session_key, 8001);
  assert.equal(pickRace(sessions, T('2026-11-02T00:00:00Z')).session_key, 9001);
  assert.equal(pickRace(sessions, T('2026-11-09T00:00:00Z')), null);
  assert.equal(pickRace([{ ...RACE, date_end: 'garbage' }], 0), null);
  assert.equal(pickRace(undefined, 0), null);
});

test('racePhase: before, running (including the wait for penalties), finished', () => {
  assert.equal(racePhase(null, 0, DELAY), 'unknown');
  assert.equal(racePhase(RACE, T('2026-11-08T13:59:59Z'), DELAY), 'before');
  assert.equal(racePhase(RACE, T('2026-11-08T14:00:00Z'), DELAY), 'running');
  assert.equal(racePhase(RACE, T('2026-11-08T17:59:59Z'), DELAY), 'running');
  assert.equal(racePhase(RACE, T('2026-11-08T18:00:00Z'), DELAY), 'finished');
});

test('findWinner needs exactly one P1 and a driver name', () => {
  const drivers = [{ driver_number: 1, full_name: 'Max VERSTAPPEN' }, { driver_number: 4, broadcast_name: 'L NORRIS' }];
  assert.deepEqual(findWinner([{ position: 2, driver_number: 4 }, { position: 1, driver_number: 1 }], drivers), { name: 'Max VERSTAPPEN', driverNumber: 1 });
  assert.equal(findWinner([{ position: 1, driver_number: 4 }], drivers).name, 'L NORRIS');
  assert.ok(findWinner([], drivers).error);
  assert.ok(findWinner([{ position: 1, driver_number: 1 }, { position: 1, driver_number: 4 }], drivers).error);
  assert.ok(findWinner([{ position: 1, driver_number: 99 }], drivers).error);
});

// A tiny fake world for the job.
function world({ now, status = 'open', createdAt = T('2026-11-04T10:00:00Z'), results, drivers, sessions = [RACE, SPRINT], outcomes = OUTS, failSettle } = {}) {
  const calls = { settle: [], close: [], logs: [], sessionFetches: [] };
  const settler = createAutoSettler({
    loadMarkets: async () => [{ id: 'm1', title: 'Next F1 Race: Winner', status, createdAt, outcomes }],
    getSessions: async (year) => { calls.sessionFetches.push(year); return year === 2026 ? sessions : []; },
    getResults: async () => results ?? [],
    getDrivers: async () => drivers ?? [],
    settle: async (id, oid) => { if (failSettle) throw new Error('boom'); calls.settle.push([id, oid]); },
    close: async (id) => { calls.close.push(id); },
    now: () => T(now),
    delayMs: DELAY,
    log: (m) => calls.logs.push(m),
  });
  return { settler, calls };
}
const GOOD_RESULTS = [{ position: 2, driver_number: 4 }, { position: 1, driver_number: 1 }];
const GOOD_DRIVERS = [{ driver_number: 1, full_name: 'Max VERSTAPPEN' }, { driver_number: 4, full_name: 'Lando NORRIS' }];

test('job: does nothing before the race', async () => {
  const { settler, calls } = world({ now: '2026-11-06T12:00:00Z' });
  assert.deepEqual(await settler.runOnce(), []);
  assert.equal(calls.close.length + calls.settle.length, 0);
});

test('job: closes predictions when the race starts, only once (not for a closed market)', async () => {
  let w = world({ now: '2026-11-08T14:05:00Z' });
  assert.deepEqual((await w.settler.runOnce()).map((d) => d.action), ['closed']);
  assert.deepEqual(w.calls.close, ['m1']);
  w = world({ now: '2026-11-08T14:05:00Z', status: 'closed' });
  assert.deepEqual(await w.settler.runOnce(), []);
  assert.equal(w.calls.close.length, 0);
});

test('job: waits out the penalty delay before settling', async () => {
  const { settler, calls } = world({ now: '2026-11-08T17:00:00Z', status: 'closed', results: GOOD_RESULTS, drivers: GOOD_DRIVERS });
  assert.deepEqual(await settler.runOnce(), []);
  assert.equal(calls.settle.length, 0);
});

test('job: settles with the P1 driver after the delay, even if the market was still open', async () => {
  for (const status of ['open', 'closed']) {
    const { settler, calls } = world({ now: '2026-11-08T18:30:00Z', status, results: GOOD_RESULTS, drivers: GOOD_DRIVERS });
    const done = await settler.runOnce();
    assert.deepEqual(calls.settle, [['m1', 'o1']]);
    assert.equal(done[0].action, 'settled');
    assert.equal(done[0].winner, 'Max VERSTAPPEN');
  }
});

test('job: no result yet -> waits and says so once', async () => {
  const { settler, calls } = world({ now: '2026-11-08T18:30:00Z', results: [], drivers: GOOD_DRIVERS });
  await settler.runOnce(); await settler.runOnce(); await settler.runOnce();
  assert.equal(calls.settle.length, 0);
  assert.equal(calls.logs.length, 1);
  assert.match(calls.logs[0], /no result published yet/);
});

test('job: winner is not an outcome -> leaves it for a human, once', async () => {
  const { settler, calls } = world({ now: '2026-11-08T18:30:00Z', results: [{ position: 1, driver_number: 44 }], drivers: [{ driver_number: 44, full_name: 'Lewis HAMILTON' }] });
  await settler.runOnce(); await settler.runOnce();
  assert.equal(calls.settle.length, 0);
  assert.equal(calls.logs.length, 1);
  assert.match(calls.logs[0], /Settle or void it by hand/);
});

test('job: a failing settle is reported, not thrown, and the next market still runs', async () => {
  const { settler, calls } = world({ now: '2026-11-08T18:30:00Z', results: GOOD_RESULTS, drivers: GOOD_DRIVERS, failSettle: true });
  assert.deepEqual(await settler.runOnce(), []);
  assert.match(calls.logs[0], /error: boom/);
});

test('job: no race on the calendar after creation -> says so', async () => {
  const { settler, calls } = world({ now: '2026-11-20T00:00:00Z', createdAt: T('2026-11-15T00:00:00Z') });
  assert.deepEqual(await settler.runOnce(), []);
  assert.match(calls.logs[0], /no race found/);
});

test('job: fetches each season schedule once per run, even with several markets', async () => {
  const calls = { n: 0 };
  const settler = createAutoSettler({
    loadMarkets: async () => [1, 2, 3].map((i) => ({ id: `m${i}`, title: 't', status: 'open', createdAt: T('2026-11-04T10:00:00Z'), outcomes: OUTS })),
    getSessions: async () => { calls.n += 1; return [RACE]; },
    getResults: async () => [], getDrivers: async () => [], settle: async () => {}, close: async () => {},
    now: () => T('2026-11-05T00:00:00Z'), delayMs: DELAY,
  });
  await settler.runOnce();
  assert.equal(calls.n, 2); // 2026 and 2027, once each
});
