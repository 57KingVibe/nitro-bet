import { env } from '../config/env.js';
import { buildUnifiedFeed } from './feed.js';

const TTL_MS = 15_000; // one upstream refresh per 15s, no matter how many users poll
let cache = { at: 0, value: null };
let inflight = null;

async function getJson(path) {
  const res = await fetch(`${env.OPENF1_BASE_URL}${path}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`OpenF1 ${path} responded ${res.status}`);
  return res.json();
}

export async function getUnifiedFeed() {
  if (cache.value && Date.now() - cache.at < TTL_MS) return cache.value;
  if (inflight) return inflight; // collapse concurrent refreshes into one

  inflight = (async () => {
    try {
      const [weather, drivers, positions] = await Promise.all([
        getJson('/weather?session_key=latest'),
        getJson('/drivers?session_key=latest'),
        getJson('/position?session_key=latest'),
      ]);
      const value = buildUnifiedFeed({ weather, drivers, positions });
      cache = { at: Date.now(), value };
      return value;
    } catch (err) {
      // Serve the last good snapshot rather than failing the whole UI.
      if (cache.value) return { ...cache.value, stale: true };
      throw err;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
