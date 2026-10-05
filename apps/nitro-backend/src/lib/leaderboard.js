// Pure helpers for the leaderboard. No database, no environment.

/** The Monday 00:00 UTC that starts the week containing `date`, and the next Monday. */
export function weekBounds(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const sinceMonday = (d.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  const start = new Date(d.getTime() - sinceMonday * 86400000);
  const end = new Date(start.getTime() + 7 * 86400000);
  return { start, end };
}

/** Name shown to the public. Ghost players never expose their display name. */
export function publicName(displayName, ghostMode, playerId) {
  if (!ghostMode) return displayName;
  return `Ghost-${String(playerId).replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}
