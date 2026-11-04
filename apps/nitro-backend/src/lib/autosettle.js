// Automatic settlement of "Next F1 Race: Winner" markets from the official OpenF1 race result.
// Pure logic on purpose: no imports, no env, no database, so it is unit-testable. The wiring is in services/autosettle.js.
//
// Rules (a market must opt in with auto_settle = 'f1_race_winner'; everything else stays manual):
//  - The market belongs to the first Race session that ends after the market was created (Sprints are ignored).
//  - Predictions close when that race starts.
//  - The market settles once the race has been over for `delayMs` (time for penalties to be applied)
//    and OpenF1 reports exactly one driver in P1 whose name matches exactly one outcome.
//  - Anything unclear (no result, no match, two matches) is left alone and reported once in the log. Settle by hand then.

/** Lower case, no accents, single spaces: "Andrea Kimi ANTONELLI" -> "andrea kimi antonelli". */
export const normName = (s) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Exact full-name match first, then a unique surname match ("Kimi Antonelli" vs "Andrea Kimi ANTONELLI"). */
export function matchOutcome(winnerName, outcomes) {
  const w = normName(winnerName);
  if (!w) return null;
  const list = outcomes ?? [];
  const exact = list.filter((o) => normName(o.label) === w);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const surname = w.split(' ').pop();
  const bySurname = list.filter((o) => normName(o.label).split(' ').pop() === surname);
  return bySurname.length === 1 ? bySurname[0] : null;
}

/** The first Race session (not Sprint) that ends after the market was created. */
export function pickRace(sessions, createdAtMs) {
  const races = (sessions ?? [])
    .filter((s) => s && s.session_name === 'Race' && Number.isFinite(Date.parse(s.date_start)) && Number.isFinite(Date.parse(s.date_end)))
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
  return races.find((s) => Date.parse(s.date_end) > createdAtMs) ?? null;
}

/** 'unknown' (no race found) | 'before' (not started) | 'running' (or waiting out the delay) | 'finished'. */
export function racePhase(race, nowMs, delayMs) {
  if (!race) return 'unknown';
  if (nowMs < Date.parse(race.date_start)) return 'before';
  if (nowMs < Date.parse(race.date_end) + delayMs) return 'running';
  return 'finished';
}

/** The single driver in P1 from OpenF1 /session_result, with a name from /drivers. */
export function findWinner(results, drivers) {
  const firsts = (results ?? []).filter((r) => Number(r.position) === 1);
  if (firsts.length === 0) return { error: 'no result published yet' };
  if (firsts.length > 1) return { error: 'more than one driver is listed in P1' };
  const d = (drivers ?? []).find((x) => x.driver_number === firsts[0].driver_number);
  const name = d?.full_name ?? d?.broadcast_name;
  if (!name) return { error: `no driver name for car #${firsts[0].driver_number}` };
  return { name, driverNumber: firsts[0].driver_number };
}

/**
 * Builds the job. Everything it touches is passed in, so tests can use fakes.
 *  loadMarkets() -> [{ id, title, status, createdAt (ms), outcomes: [{ id, label }] }]
 *  getSessions(year), getResults(sessionKey), getDrivers(sessionKey) -> OpenF1 rows
 *  settle(marketId, outcomeId), close(marketId)
 */
export function createAutoSettler({ loadMarkets, getSessions, getResults, getDrivers, settle, close, now = () => Date.now(), delayMs, log = () => {} }) {
  const noted = new Map();
  const note = (id, msg) => {
    if (noted.get(id) === msg) return; // say each thing once, not every few minutes
    noted.set(id, msg);
    log(`[AUTO] market ${id}: ${msg}`);
  };

  async function runOnce() {
    const done = [];
    const nowMs = now();
    const sessionsByYear = new Map();
    const sessionsFor = async (year) => {
      if (!sessionsByYear.has(year)) sessionsByYear.set(year, await getSessions(year));
      return sessionsByYear.get(year);
    };

    for (const m of await loadMarkets()) {
      try {
        const y = new Date(m.createdAt).getUTCFullYear();
        const sessions = [...(await sessionsFor(y)), ...(await sessionsFor(y + 1))];
        const race = pickRace(sessions, m.createdAt);
        const phase = racePhase(race, nowMs, delayMs);

        if (phase === 'unknown') { note(m.id, 'no race found after this market was created (schedule not published yet?)'); continue; }
        if (phase === 'before') continue;
        if (phase === 'running') {
          if (m.status === 'open') { await close(m.id); done.push({ marketId: m.id, action: 'closed', race: race.session_key }); }
          continue;
        }

        const winner = findWinner(await getResults(race.session_key), await getDrivers(race.session_key));
        if (winner.error) { note(m.id, `waiting: ${winner.error}`); continue; }
        const outcome = matchOutcome(winner.name, m.outcomes);
        if (!outcome) { note(m.id, `the winner "${winner.name}" matches none (or more than one) of the outcomes. Settle or void it by hand.`); continue; }

        await settle(m.id, outcome.id);
        done.push({ marketId: m.id, action: 'settled', winner: winner.name, race: race.session_key });
      } catch (err) {
        note(m.id, `error: ${err.message}`);
      }
    }
    return done;
  }

  return { runOnce };
}
