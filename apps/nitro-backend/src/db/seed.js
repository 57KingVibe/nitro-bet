import { env } from '../config/env.js';
import { withTx } from './tx.js';

// Demo market so the app has something to bet on in play-money mode. Never runs in real-money mode.
const DEMO = [
  ['Max Verstappen', 159], ['Lando Norris', 356], ['Charles Leclerc', 562],
  ['Oscar Piastri', 808], ['Lewis Hamilton', 1225],
];

export async function seedDemoMarket() {
  if (env.REAL_MONEY_ENABLED === 'true') return;
  await withTx(async (client) => {
    const { rows } = await client.query('SELECT 1 FROM markets LIMIT 1');
    if (rows.length) return;
    const { rows: m } = await client.query(
      "INSERT INTO markets (sport, title) VALUES ('F1', 'Next F1 Race: Winner (demo)') RETURNING id");
    for (const [i, [label, odds]] of DEMO.entries()) {
      await client.query('INSERT INTO outcomes (market_id, label, odds_centi, sort) VALUES ($1,$2,$3,$4)', [m[0].id, label, odds, i]);
    }
    console.log('[DB] demo market created');
  });
}
