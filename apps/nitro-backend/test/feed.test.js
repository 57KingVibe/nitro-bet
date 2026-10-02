import test from 'node:test';
import assert from 'node:assert/strict';
import { latestPositions, latestWeather, buildUnifiedFeed } from '../src/services/feed.js';

const positions = [
  { driver_number: 1, position: 2, date: '2026-01-01T10:00:00Z' },
  { driver_number: 44, position: 1, date: '2026-01-01T10:00:00Z' },
  { driver_number: 1, position: 1, date: '2026-01-01T10:05:00Z' }, // newer: 1 overtakes 44
  { driver_number: 44, position: 2, date: '2026-01-01T10:05:00Z' },
];
const drivers = [
  { driver_number: 1, full_name: 'Max Verstappen', team_name: 'Red Bull Racing' },
  { driver_number: 44, full_name: 'Lewis Hamilton', team_name: 'Ferrari' },
];

test('latestPositions keeps only the newest row per driver, sorted by position', () => {
  const out = latestPositions(positions);
  assert.deepEqual(out.map((r) => r.driver_number), [1, 44]);
});

test('latestWeather picks the newest sample', () => {
  const w = latestWeather([
    { date: '2026-01-01T10:00:00Z', track_temperature: 30 },
    { date: '2026-01-01T10:02:00Z', track_temperature: 32 },
  ]);
  assert.equal(w.track_temperature, 32);
});

test('buildUnifiedFeed joins driver names and exposes tempC', () => {
  const feed = buildUnifiedFeed({
    weather: [{ date: '2026-01-01T10:00:00Z', track_temperature: 41.5, air_temperature: 28, rainfall: 0 }],
    drivers,
    positions,
  });
  assert.equal(feed.leaderboard[0].name, 'Max Verstappen');
  assert.equal(feed.trackConditions.tempC, 41.5);
  assert.equal(feed.source, 'openf1');
});

test('buildUnifiedFeed tolerates empty upstream data', () => {
  const feed = buildUnifiedFeed({});
  assert.deepEqual(feed.leaderboard, []);
  assert.equal(feed.trackConditions, null);
});

test('unknown driver number falls back to a readable label', () => {
  const feed = buildUnifiedFeed({ positions: [{ driver_number: 99, position: 1, date: '2026-01-01T10:00:00Z' }] });
  assert.equal(feed.leaderboard[0].name, 'Driver #99');
});
