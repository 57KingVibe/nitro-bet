import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { settleMarket, closeMarket } from './betting.js';
import { createAutoSettler } from '../lib/autosettle.js';

const ACTOR = 'auto:openf1';

// OpenF1 answers "nothing found" with a 404, which here just means an empty list.
async function rows(path) {
  const res = await fetch(`${env.OPENF1_BASE_URL}${path}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`OpenF1 ${path} responded ${res.status}`);
  const body = await res.json();
  return Array.isArray(body) ? body : [];
}

async function loadMarkets() {
  const { rows: ms } = await pool.query(
    `SELECT m.id, m.title, m.status, (EXTRACT(EPOCH FROM m.created_at) * 1000)::bigint AS created_ms,
            json_agg(json_build_object('id', o.id, 'label', o.label) ORDER BY o.sort) AS outcomes
     FROM markets m JOIN outcomes o ON o.market_id = m.id
     WHERE m.auto_settle = 'f1_race_winner' AND m.status IN ('open', 'closed')
     GROUP BY m.id`);
  return ms.map((r) => ({ id: r.id, title: r.title, status: r.status, createdAt: Number(r.created_ms), outcomes: r.outcomes }));
}

export function startAutoSettle() {
  if (env.REAL_MONEY_ENABLED === 'true') { console.log('[AUTO] auto-settle never runs in real-money mode'); return; }
  if (env.AUTO_SETTLE_ENABLED !== 'true') { console.log('[AUTO] auto-settle is off (AUTO_SETTLE_ENABLED=false)'); return; }

  const settler = createAutoSettler({
    loadMarkets,
    getSessions: (year) => rows(`/sessions?session_name=Race&year=${year}`),
    getResults: (key) => rows(`/session_result?session_key=${key}`),
    getDrivers: (key) => rows(`/drivers?session_key=${key}`),
    settle: (marketId, winningOutcomeId) => settleMarket({ marketId, winningOutcomeId, actor: ACTOR }),
    close: (marketId) => closeMarket({ marketId, actor: ACTOR }),
    delayMs: env.AUTO_SETTLE_DELAY_MIN * 60_000,
    log: (msg) => console.log(msg),
  });

  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const d of await settler.runOnce()) console.log('[AUTO]', JSON.stringify(d));
    } catch (err) {
      console.error('[AUTO] run failed:', err.message);
    } finally {
      busy = false;
    }
  };
  setTimeout(tick, 30_000).unref();
  setInterval(tick, env.AUTO_SETTLE_INTERVAL_MIN * 60_000).unref();
  console.log(`[AUTO] auto-settle on: checking every ${env.AUTO_SETTLE_INTERVAL_MIN} min, ${env.AUTO_SETTLE_DELAY_MIN} min after each race`);
}
