// Pure helpers: turn raw OpenF1 rows into the shape the frontend expects.
// No imports and no env access on purpose, so this file is trivially unit-testable.

/** Newest row per driver from OpenF1 /position (the endpoint is an append-only history). */
export function latestPositions(rows = []) {
  const latest = new Map();
  for (const row of rows) {
    const prev = latest.get(row.driver_number);
    if (!prev || new Date(row.date) >= new Date(prev.date)) latest.set(row.driver_number, row);
  }
  return [...latest.values()].sort((a, b) => a.position - b.position);
}

/** Newest weather sample (OpenF1 reports roughly one per minute). */
export function latestWeather(rows = []) {
  return rows.reduce((best, row) => (!best || new Date(row.date) >= new Date(best.date) ? row : best), null);
}

export function buildUnifiedFeed({ weather = [], drivers = [], positions = [] } = {}) {
  const byNumber = new Map(drivers.map((d) => [d.driver_number, d]));
  const w = latestWeather(weather);

  const leaderboard = latestPositions(positions)
    .slice(0, 10)
    .map((row) => {
      const d = byNumber.get(row.driver_number);
      return {
        position: row.position,
        driverNumber: row.driver_number,
        name: d?.full_name ?? `Driver #${row.driver_number}`,
        team: d?.team_name ?? null,
      };
    });

  return {
    source: 'openf1',
    updatedAt: new Date().toISOString(),
    // OpenF1 reports Celsius; the UI shows Celsius too (the old UI mislabelled it as °F).
    trackConditions: w
      ? { tempC: w.track_temperature, airTempC: w.air_temperature, rainfall: w.rainfall }
      : null,
    leaderboard,
  };
}
