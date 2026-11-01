// Stand-in for the real API: same routes, field names and status codes as apps/nitro-backend, and it uses the REAL pool maths.
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { seedsFromOdds, poolState, estimateReturnMinor, planPoolSettlement, buildCandles, INTERVALS_MS, toBp } from '../../apps/nitro-backend/src/lib/pool.js';
import { recoverAddress, isAddress, toChecksumAddress } from '../../apps/nitro-backend/src/lib/eth.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// Settings the new-feature checks rely on (same field names as GET /api/config in the real server).
export const MOCK_CONFIG = { googleClientId: 'test-client-id.apps.googleusercontent.com', social: { discord: 'https://discord.gg/apexly-test', x: 'https://x.com/apexly_test' },
  referral: { bonus: '500.00', maxRewards: 10 }, minAge: 18, realMoney: false, currency: 'PLAY' };

export function startMock(port) {
  const players = new Map(); const tokens = new Map(); const wagers = []; const ledger = []; const state = { requests: [], registrations: [], wallets: {} };
  const codeOf = (p) => { if (!p.code) p.code = Array.from({ length: 8 }, (_, i) => CODE_ALPHABET[parseInt(p.id.replace(/-/g, '').slice(i * 2, i * 2 + 2), 16) % CODE_ALPHABET.length]).join(''); return p.code; };
  const challenges = new Map();
  const newSession = (p) => { const t = `tok-${randomUUID()}`; tokens.set(t, p); return { token: t, player: { id: p.id, email: p.email, displayName: p.displayName } }; };
  const signup = (p, ref) => { players.set(p.id, p); p.referredBy = ref ?? null; state.registrations.push({ email: p.email, ref: ref ?? null, via: p.google ? 'google' : 'password' }); ledger.push({ pid: p.id, kind: 'signup_credit', amountMinor: 100000, id: ledger.length + 1, createdAt: new Date().toISOString() }); };
  const odds0 = [['Max Verstappen', 159], ['Lando Norris', 356], ['Charles Leclerc', 562], ['Oscar Piastri', 808], ['Lewis Hamilton', 1225]];
  const seeds = seedsFromOdds(odds0.map((o) => o[1]), 100000);
  const market = { id: randomUUID(), title: 'Next F1 Race: Winner', status: 'open', outcomes: odds0.map(([label], i) => ({ id: randomUUID(), label, seedMinor: seeds[i] })) };
  const fmt = (m) => (m / 100).toFixed(2);
  const bal = (id) => ledger.filter((l) => l.pid === id).reduce((a, l) => a + l.amountMinor, 0);
  const staked = (oid) => wagers.filter((w) => w.outcomeId === oid && w.status !== 'void').reduce((a, w) => a + w.stakeMinor, 0);
  const pools = () => poolState(market.outcomes.map((o) => ({ id: o.id, seedMinor: o.seedMinor, stakedMinor: staked(o.id) })));
  const marketView = () => { const st = pools(); return { id: market.id, title: market.title, sport: 'F1', status: market.status, closesAt: null, model: 'pool', poolTotalMinor: st.totalMinor,
    outcomes: market.outcomes.map((o, i) => ({ id: o.id, label: o.label, odds: (st.outcomes[i].oddsCenti / 100).toFixed(2), oddsCenti: st.outcomes[i].oddsCenti, priceBp: st.outcomes[i].priceBp, poolMinor: st.outcomes[i].poolMinor })) }; };
  const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS' }); res.end(JSON.stringify(body)); };
  const err = (res, code, message, errCode, extra = {}) => send(res, code, { error: 'HttpError', message, code: errCode, ...extra });
  const profile = (p) => ({ id: p.id, email: p.email, displayName: p.displayName, currency: 'PLAY', realMoney: false, balanceMinor: bal(p.id), balance: fmt(bal(p.id)), ghostMode: p.ghost, selfExcludedUntil: null });
  const auth = (req, res) => {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) { send(res, 401, { error: 'Access denied. Missing token.' }); return null; }
    const p = tokens.get(h.split(' ')[1]);
    if (!p) { send(res, 403, { error: 'Invalid or expired token.' }); return null; }
    return p;
  };
  const wagerRow = (w) => ({ id: w.id, stake: fmt(w.stakeMinor), stakeMinor: w.stakeMinor, odds: (w.oddsCenti / 100).toFixed(2), oddsCenti: w.oddsCenti, potentialPayout: fmt(w.potentialMinor), potentialPayoutMinor: w.potentialMinor,
    payout: w.payoutMinor == null ? null : fmt(w.payoutMinor), payoutMinor: w.payoutMinor ?? null, status: w.status, createdAt: w.createdAt, settledAt: null, outcomeLabel: w.label, marketTitle: market.title });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'); const path = url.pathname;
    state.requests.push(`${req.method} ${path}`);
    if (req.method === 'OPTIONS') return send(res, 204, {});
    let body = {}; if (['POST', 'PATCH'].includes(req.method)) { let raw = ''; for await (const c of req) raw += c; try { body = JSON.parse(raw || '{}'); } catch {} }

    if (path === '/api/markets') return send(res, 200, { markets: market.status === 'open' ? [marketView()] : [] });
    if (/^\/api\/markets\/[^/]+\/chart$/.test(path)) {
      const interval = url.searchParams.get('interval') ?? '15m';
      const built = buildCandles({ outcomes: market.outcomes, intervalMs: INTERVALS_MS[interval], events: wagers.filter((w) => w.status !== 'void').map((w) => ({ t: Date.parse(w.createdAt), outcomeId: w.outcomeId, stakeMinor: w.stakeMinor })) });
      return send(res, 200, { marketId: market.id, model: 'pool', interval, status: market.status, totalMinor: built.totalMinor, total: fmt(built.totalMinor),
        outcomes: market.outcomes.map((o) => ({ id: o.id, label: o.label, poolMinor: built.pools.get(o.id), priceBp: toBp(built.pools.get(o.id), built.totalMinor), candles: built.candles.get(o.id) })) });
    }
    if (path === '/api/stream/unified') return send(res, 200, { source: 'openf1', updatedAt: new Date().toISOString(), trackConditions: { tempC: 39.5, airTempC: 26.4, rainfall: 0 }, leaderboard: [{ position: 1, driverNumber: 1, name: 'Max VERSTAPPEN', team: 'Red Bull Racing' }] });
    if (path === '/api/auth/register' && req.method === 'POST') {
      const age = (Date.now() - new Date(body.dateOfBirth).getTime()) / 31557600000;
      if (age < 18) return err(res, 403, 'You must be at least 18 years old.', 'UNDERAGE');
      if ([...players.values()].some((p) => p.email === body.email)) return err(res, 409, 'That email is already registered.', 'EMAIL_TAKEN');
      const p = { id: randomUUID(), email: body.email, password: body.password, displayName: body.displayName, ghost: false };
      signup(p, body.ref);
      return send(res, 201, newSession(p));
    }
    if (path === '/api/config') return send(res, 200, MOCK_CONFIG);
    if (path === '/api/auth/google' && req.method === 'POST') {
      // stand-in for Google verification: credentials look like "fake:<email>:<name>"
      const m = /^fake:([^:]+):(.*)$/.exec(String(body.credential ?? ''));
      if (!m) return err(res, 401, 'Google sign-in could not be verified. Please try again.', 'BAD_GOOGLE_TOKEN');
      const [, email, name] = m;
      const known = [...players.values()].find((x) => x.email === email);
      if (known) return send(res, 200, newSession(known));
      if (!body.dateOfBirth) return send(res, 200, { needsSignup: true, email, name });
      const age = (Date.now() - new Date(body.dateOfBirth).getTime()) / 31557600000;
      if (age < 18) return err(res, 403, 'You must be at least 18 years old.', 'UNDERAGE');
      const p = { id: randomUUID(), email, password: null, displayName: name || email.split('@')[0], ghost: false, google: true };
      signup(p, body.ref);
      return send(res, 200, newSession(p));
    }
    if (path === '/api/auth/login' && req.method === 'POST') {
      const p = [...players.values()].find((x) => x.email === body.email && x.password === body.password);
      if (!p) return err(res, 401, 'Invalid email or password.', 'BAD_CREDENTIALS');
      const t = `tok-${randomUUID()}`; tokens.set(t, p); return send(res, 200, { token: t, player: { id: p.id, email: p.email, displayName: p.displayName } });
    }
    if (path === '/api/leaderboard') {
      const scores = new Map();
      for (const w of wagers.filter((w) => w.status === 'won' || w.status === 'lost')) { const s = scores.get(w.pid) ?? { net: 0, n: 0 }; s.net += (w.status === 'won' ? w.payoutMinor : 0) - w.stakeMinor; s.n++; scores.set(w.pid, s); }
      const entries = [...scores.entries()].sort((a, b) => b[1].net - a[1].net).map(([pid, s], i) => { const p = players.get(pid); return { rank: i + 1, name: p.ghost ? `Ghost-${pid.replace(/-/g, '').slice(0, 4).toUpperCase()}` : p.displayName, netMinor: s.net, net: fmt(s.net), predictions: s.n }; });
      return send(res, 200, { period: url.searchParams.get('period') ?? 'week', endsAt: new Date(Date.now() + 3 * 86400000).toISOString(), prizesEnabled: false, minSettled: 1, entries });
    }
    if (path === '/__settle') {   // first outcome wins; uses the real pool settlement plan
      const open = wagers.filter((w) => w.status === 'open');
      const plan = planPoolSettlement({ wagers: open.map((w) => ({ id: w.id, playerId: w.pid, currency: 'PLAY', outcomeId: w.outcomeId, stakeMinor: w.stakeMinor })), winningOutcomeId: market.outcomes[0].id, seeds: Object.fromEntries(market.outcomes.map((o) => [o.id, o.seedMinor])) });
      for (const it of plan.items) { const w = wagers.find((x) => x.id === it.wagerId); w.status = it.status; w.payoutMinor = it.payoutMinor; if (it.status === 'won') ledger.push({ pid: w.pid, kind: 'bet_payout', amountMinor: it.payoutMinor, id: ledger.length + 1, createdAt: new Date().toISOString() }); }
      market.status = 'settled'; return send(res, 200, { ok: true, settled: plan.items.length });
    }
    if (path === '/__state') return send(res, 200, { requests: state.requests, wagers: wagers.length, registrations: state.registrations, wallets: state.wallets });

    const me = auth(req, res); if (!me) return;
    if (path === '/api/me' && req.method === 'GET') return send(res, 200, profile(me));
    if (path === '/api/me/ledger') return send(res, 200, { entries: ledger.filter((l) => l.pid === me.id).slice().reverse().map((l) => ({ id: l.id, kind: l.kind, currency: 'PLAY', amountMinor: l.amountMinor, amount: fmt(l.amountMinor), createdAt: l.createdAt })) });
    if (path === '/api/me/settings' && req.method === 'PATCH') { me.ghost = !!body.ghostMode; return send(res, 200, { ghostMode: me.ghost }); }
    if (path === '/api/me/referral') {
      const invited = [...players.values()].filter((x) => x.referredBy === codeOf(me)).length;
      return send(res, 200, { code: codeOf(me), invited, rewarded: 0, pending: invited, bonus: MOCK_CONFIG.referral.bonus, maxRewards: MOCK_CONFIG.referral.maxRewards });
    }
    if (path === '/api/me/wallet' && req.method === 'GET') return send(res, 200, state.wallets[me.id] ? { address: toChecksumAddress(state.wallets[me.id]) } : { address: null });
    if (path === '/api/me/wallet/challenge' && req.method === 'POST') {
      if (!isAddress(body.address)) return err(res, 400, 'That does not look like an Ethereum address.', 'BAD_ADDRESS');
      const message = `127.0.0.1:4778 wants you to link your Ethereum wallet.\n\nAddress: ${toChecksumAddress(body.address)}\nNonce: ${randomUUID()}`;
      challenges.set(me.id, { address: body.address.toLowerCase(), message });
      return send(res, 200, { message });
    }
    if (path === '/api/me/wallet' && req.method === 'POST') {
      const ch = challenges.get(me.id);
      if (!ch || ch.address !== String(body.address).toLowerCase()) return err(res, 400, 'Start again: request a new signing message first.', 'NO_CHALLENGE');
      let signer; try { signer = recoverAddress(ch.message, body.signature); } catch { return err(res, 400, 'That signature is not valid.', 'BAD_SIGNATURE'); }
      if (signer !== ch.address) return err(res, 400, 'The signature does not match that wallet.', 'BAD_SIGNATURE');
      state.wallets[me.id] = signer; challenges.delete(me.id);
      return send(res, 200, { address: toChecksumAddress(signer) });
    }
    if (path === '/api/leaderboard/me') return send(res, 200, { period: 'week', ranked: false });
    if (path === '/api/wagers' && req.method === 'GET') return send(res, 200, { wagers: wagers.filter((w) => w.pid === me.id).slice().reverse().map(wagerRow) });
    if (path === '/api/wagers' && req.method === 'POST') {
      const prior = wagers.find((w) => w.pid === me.id && w.key === body.idempotencyKey);
      if (prior) return send(res, 200, { wager: { id: prior.id }, balanceMinor: bal(me.id), balance: fmt(bal(me.id)), replayed: true });
      const o = market.outcomes.find((x) => x.id === body.outcomeId); if (!o) return err(res, 404, 'Outcome not found.', 'OUTCOME_NOT_FOUND');
      const stakeMinor = Math.round(Number(body.stake) * 100);
      if (stakeMinor > 50000) return err(res, 400, 'Stake is above the maximum.', 'STAKE_TOO_HIGH');
      if (bal(me.id) < stakeMinor) return err(res, 402, 'Insufficient balance.', 'INSUFFICIENT_FUNDS');
      const st = pools(); const mine = st.outcomes.find((x) => x.id === o.id);   // pool market: acceptedOdds is not used, as in the real API
      const w = { id: randomUUID(), pid: me.id, key: body.idempotencyKey, outcomeId: o.id, label: o.label, stakeMinor, oddsCenti: mine.oddsCenti, potentialMinor: estimateReturnMinor(stakeMinor, mine.poolMinor, st.totalMinor), status: 'open', createdAt: new Date().toISOString() };
      wagers.push(w); ledger.push({ pid: me.id, kind: 'bet_stake', amountMinor: -stakeMinor, id: ledger.length + 1, createdAt: w.createdAt });
      return send(res, 201, { wager: { id: w.id }, balanceMinor: bal(me.id), balance: fmt(bal(me.id)), replayed: false });
    }
    return send(res, 404, { error: 'Not found' });
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}
