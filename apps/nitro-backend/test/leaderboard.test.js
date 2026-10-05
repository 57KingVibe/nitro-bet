import test from 'node:test';
import assert from 'node:assert/strict';
import { weekBounds, publicName } from '../src/lib/leaderboard.js';

test('weekBounds: a Wednesday belongs to the week that started on Monday 00:00 UTC', () => {
  const { start, end } = weekBounds(new Date('2026-10-07T15:30:00Z')); // Wednesday
  assert.equal(start.toISOString(), '2026-10-05T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-12T00:00:00.000Z');
});

test('weekBounds: Sunday night is still the old week, Monday morning starts the next', () => {
  assert.equal(weekBounds(new Date('2026-10-11T23:59:59Z')).start.toISOString(), '2026-10-05T00:00:00.000Z');
  assert.equal(weekBounds(new Date('2026-10-12T00:00:00Z')).start.toISOString(), '2026-10-12T00:00:00.000Z');
});

test('weekBounds: exactly Monday 00:00 is the start of its own week', () => {
  const { start, end } = weekBounds(new Date('2026-10-05T00:00:00Z'));
  assert.equal(start.toISOString(), '2026-10-05T00:00:00.000Z');
  assert.equal(end.getTime() - start.getTime(), 7 * 86400000);
});

test('publicName hides ghost players and never leaks the display name', () => {
  assert.equal(publicName('Alex', false, 'x'), 'Alex');
  const masked = publicName('Alex', true, 'dbe2b9a9-6040-4f39-ba86-19845ffefc97');
  assert.equal(masked, 'Ghost-DBE2');
  assert.ok(!masked.includes('Alex'));
});
