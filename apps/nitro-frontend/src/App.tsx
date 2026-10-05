import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CATEGORIES, MOCK_RACES, MOCK_RESULTS } from './constants';
import { Category, Driver, SlipItem } from './types';
import {
  api, ApiError, Market, Profile, WagerRow, LedgerEntry,
  getToken, clearToken, isSessionError, friendlyError, fmtPts,
} from './api';
import { buildCards, PrevOdds } from './lib/cards';
import DriverCard from './components/DriverCard';
import PredictionSlip from './components/PredictionSlip';
import LiveTelemetry from './components/LiveTelemetry';
import RaceResults from './components/RaceResults';
import AccountModal from './components/AccountModal';
import AuthModal from './components/AuthModal';
import Leaderboard from './components/Leaderboard';
import InstallCard from './components/InstallCard';

type SortOrder = 'none' | 'asc' | 'desc';
type BottomView = 'upcoming' | 'results';
type Toast = { kind: 'ok' | 'err'; text: string } | null;

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const App: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<Category>('F1');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [cards, setCards] = useState<Record<string, Driver[]>>({});
  const [marketsState, setMarketsState] = useState<'loading' | 'ok' | 'error'>('loading');
  const prevOdds = useRef<PrevOdds>({});

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wagers, setWagers] = useState<WagerRow[] | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [slip, setSlip] = useState<SlipItem[]>([]);
  const [placing, setPlacing] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('none');
  const [bottomView, setBottomView] = useState<BottomView>('upcoming');
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
  const [toast, setToast] = useState<Toast>(null);

  const say = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 4500);
  }, []);

  // ---------- markets (public, polled) ----------
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const { markets: list } = await api.markets();
        if (cancelled) return;
        const nextCards: Record<string, Driver[]> = {};
        const nextOdds: PrevOdds = {};
        for (const m of list) {
          const built = buildCards(m, prevOdds.current);
          nextCards[m.id] = built.cards;
          Object.assign(nextOdds, built.next);
        }
        prevOdds.current = nextOdds;
        setMarkets(list);
        setCards(nextCards);
        setMarketsState('ok');
      } catch {
        if (!cancelled) setMarketsState((s) => (s === 'ok' ? 'ok' : 'error'));
      } finally {
        if (!cancelled) timer = setTimeout(load, 15000);
      }
    };
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // ---------- account ----------
  const signOut = useCallback((message?: string) => {
    clearToken();
    setProfile(null); setWagers(null); setLedger(null); setSlip([]); setIsAccountOpen(false);
    setBoardKey((k) => k + 1);
    if (message) say('err', message);
  }, [say]);

  const loadProfile = useCallback(async () => {
    try { setProfile(await api.me()); }
    catch (e) { if (isSessionError(e)) signOut('Your session expired. Please sign in again.'); }
  }, [signOut]);

  const loadAccountData = useCallback(async () => {
    try {
      const [w, l] = await Promise.all([api.wagers(), api.ledger()]);
      setWagers(w.wagers); setLedger(l.entries);
    } catch (e) { if (isSessionError(e)) signOut('Your session expired. Please sign in again.'); }
  }, [signOut]);

  useEffect(() => { if (getToken()) loadProfile(); }, [loadProfile]);

  const openAccount = () => { setIsAccountOpen(true); loadProfile(); loadAccountData(); };

  const onAuthed = async () => {
    setIsAuthOpen(false);
    await loadProfile();
    setBoardKey((k) => k + 1);
    say('ok', 'You are in. Pick a driver to make your first prediction.');
  };

  const toggleGhost = async (next: boolean) => {
    try { await api.setGhostMode(next); await loadProfile(); setBoardKey((k) => k + 1); }
    catch (e) { if (isSessionError(e)) signOut('Your session expired. Please sign in again.'); else say('err', friendlyError(e)); }
  };

  // ---------- slip ----------
  const outcomeIndex = useMemo(() => {
    const idx = new Map<string, { marketTitle: string }>();
    for (const m of markets) for (const o of m.outcomes) idx.set(o.id, { marketTitle: m.title });
    return idx;
  }, [markets]);

  const handlePick = (driver: Driver, stake: number) => {
    const info = outcomeIndex.get(driver.id);
    if (!info) return;
    setSlip((prev) => {
      const existing = prev.find((i) => i.outcomeId === driver.id);
      const item: SlipItem = {
        outcomeId: driver.id, marketTitle: info.marketTitle, label: driver.name, odds: driver.odds, stake,
        trend: driver.trend, idempotencyKey: existing?.idempotencyKey ?? newKey(),
      };
      return existing ? prev.map((i) => (i.outcomeId === driver.id ? item : i)) : [...prev, item];
    });
  };

  const handlePlace = async () => {
    if (!profile) { setIsAuthOpen(true); return; }
    if (slip.length === 0 || placing) return;
    setPlacing(true);
    const remaining: SlipItem[] = [];
    let placed = 0;
    for (const item of slip) {
      try {
        await api.placeWager({ outcomeId: item.outcomeId, stake: item.stake, acceptedOdds: item.odds.toFixed(2), idempotencyKey: item.idempotencyKey });
        placed++;
      } catch (e) {
        if (isSessionError(e)) { setPlacing(false); signOut('Your session expired. Please sign in again.'); return; }
        const newOdds = e instanceof ApiError && e.currentOddsCenti ? e.currentOddsCenti / 100 : item.odds;
        remaining.push({ ...item, odds: newOdds, error: friendlyError(e) });
      }
    }
    setSlip(remaining);
    setPlacing(false);
    await loadProfile();
    if (isAccountOpen) loadAccountData();
    setBoardKey((k) => k + 1);
    if (placed > 0 && remaining.length === 0) say('ok', placed === 1 ? 'Prediction locked in.' : `${placed} predictions locked in.`);
    else if (placed > 0) say('err', `${placed} locked in, ${remaining.length} need your attention.`);
    else say('err', 'Nothing was placed. Check the messages on your slip.');
  };

  const balanceNum = profile ? Number(profile.balance) : null;

  const sortCards = (list: Driver[]) => {
    const copy = [...list];
    if (sortOrder === 'asc') return copy.sort((a, b) => a.odds - b.odds);
    if (sortOrder === 'desc') return copy.sort((a, b) => b.odds - a.odds);
    return copy;
  };

  const avatar = profile ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.displayName)}` : '';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row max-w-[1600px] mx-auto relative overflow-hidden bg-slate-950">
      <aside className="w-full lg:w-20 bg-slate-950 border-r border-slate-900 flex flex-row lg:flex-col items-center py-4 lg:py-8 gap-6 px-4 lg:px-0 sticky top-0 z-50">
        <img src="/icons/icon-192.png" alt="NitroBet" className="w-10 h-10 rounded-lg shadow-lg shadow-red-500/20" />
        <div className="flex flex-row lg:flex-col gap-6 flex-1 items-center">
          {CATEGORIES.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id as Category)} className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${selectedCategory === cat.id ? 'bg-slate-800 text-white border border-red-500/50' : 'text-slate-500 hover:text-slate-300'}`}>{cat.icon}</button>
          ))}
        </div>
        {profile ? (
          <button onClick={openAccount} className={`w-12 h-12 rounded-full border-2 overflow-hidden transition-all ${profile.ghostMode ? 'border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'border-slate-800'}`} aria-label="Account">
            <img src={avatar} alt="You" />
          </button>
        ) : (
          <button onClick={() => setIsAuthOpen(true)} className="w-12 h-12 rounded-full border-2 border-slate-800 text-xl text-slate-400 hover:text-white" aria-label="Sign in">👤</button>
        )}
      </aside>

      <main className="flex-1 p-4 lg:p-8 space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl lg:text-5xl font-racing font-black tracking-tighter italic uppercase text-white">Nitro<span className="text-red-600">Bet</span></h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-2 italic flex items-center gap-2">
              {profile?.ghostMode ? <span className="text-indigo-500 animate-pulse">👻 GHOST MODE ON</span> : 'Precision. Adrenaline. Glory.'}
            </p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[8px] font-black uppercase tracking-widest text-emerald-400">Lite - free to play - points have no cash value</span>
          </div>
          {profile ? (
            <button onClick={openAccount} className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-2 rounded-2xl pr-6 shadow-xl hover:bg-slate-800 transition-all">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${profile.ghostMode ? 'bg-indigo-600 text-white' : 'bg-red-600/20 text-red-400'}`}>P</div>
              <div className="text-left">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Points</p>
                <p className="text-lg font-racing font-black text-white">{fmtPts(profile.balance)}</p>
              </div>
            </button>
          ) : (
            <button onClick={() => setIsAuthOpen(true)} className="bg-red-600 hover:bg-red-500 glow-red px-6 py-3 rounded-2xl font-racing text-xs font-black uppercase">Join free</button>
          )}
        </header>

        <LiveTelemetry />

        {selectedCategory !== 'F1' ? (
          <section className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-10 text-center">
            <p className="font-racing text-sm font-black uppercase tracking-widest text-slate-400">{CATEGORIES.find((c) => c.id === selectedCategory)?.name} markets are coming soon</p>
            <p className="text-xs text-slate-600 mt-2">Formula 1 is open now.</p>
          </section>
        ) : marketsState === 'loading' ? (
          <section className="space-y-3 animate-pulse">
            <div className="h-5 w-48 bg-slate-800 rounded"></div>
            <div className="h-24 bg-slate-900 rounded-xl"></div>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Loading markets... the first load can take up to a minute.</p>
          </section>
        ) : marketsState === 'error' && markets.length === 0 ? (
          <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-sm font-bold text-slate-300">Markets are offline right now.</p>
            <p className="text-xs text-slate-500 mt-1">We keep retrying. Pull to refresh if it stays like this.</p>
          </section>
        ) : markets.length === 0 ? (
          <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-sm font-bold text-slate-300">No open markets right now.</p>
            <p className="text-xs text-slate-500 mt-1">New markets open before each race. Check back soon.</p>
          </section>
        ) : (
          markets.map((m) => (
            <section key={m.id}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="font-racing text-lg font-black uppercase tracking-widest flex items-center gap-2"><span className="w-1 h-6 bg-red-600"></span> {m.title}</h2>
                  {m.closesAt && <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 ml-3">Closes {new Date(m.closesAt).toLocaleString()}</p>}
                </div>
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button onClick={() => setSortOrder('none')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${sortOrder === 'none' ? 'bg-slate-800 text-white shadow' : 'text-slate-500'}`}>Default</button>
                  <button onClick={() => setSortOrder('asc')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${sortOrder === 'asc' ? 'bg-slate-800 text-white shadow' : 'text-slate-500'}`}>Lowest</button>
                  <button onClick={() => setSortOrder('desc')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${sortOrder === 'desc' ? 'bg-slate-800 text-white shadow' : 'text-slate-500'}`}>Highest</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortCards(cards[m.id] ?? []).map((driver) => (
                  <DriverCard key={driver.id} driver={driver} onBet={handlePick} />
                ))}
              </div>
            </section>
          ))
        )}

        <Leaderboard loggedIn={!!profile} refreshKey={boardKey} />

        <section className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-6 mb-6 border-b border-slate-800 pb-4">
            <button onClick={() => setBottomView('upcoming')} className={`font-racing text-xs font-black uppercase tracking-[0.2em] relative ${bottomView === 'upcoming' ? 'text-white' : 'text-slate-600'}`}>Coming Fast {bottomView === 'upcoming' && <span className="absolute -bottom-[17px] left-0 w-full h-0.5 bg-red-600"></span>}</button>
            <button onClick={() => setBottomView('results')} className={`font-racing text-xs font-black uppercase tracking-[0.2em] relative ${bottomView === 'results' ? 'text-white' : 'text-slate-600'}`}>Race Results {bottomView === 'results' && <span className="absolute -bottom-[17px] left-0 w-full h-0.5 bg-red-600"></span>}</button>
            <span className="ml-auto text-[8px] font-black uppercase tracking-widest text-slate-600 border border-slate-800 rounded px-1.5 py-0.5">Sample data</span>
          </div>
          {bottomView === 'upcoming' ? (
            <div className="space-y-4">
              {MOCK_RACES.filter((r) => r.status !== 'Live').map((race) => (
                <div key={race.id} className="flex items-center justify-between p-3 border-b border-slate-800 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 text-xs">{race.category}</div>
                    <div><p className="text-sm font-bold text-white">{race.title}</p><p className="text-[10px] text-slate-500 uppercase">{race.location}</p></div>
                  </div>
                  <p className="text-xs font-racing text-red-500/80">{race.date}</p>
                </div>
              ))}
            </div>
          ) : (
            <RaceResults results={MOCK_RESULTS} />
          )}
        </section>
      </main>

      <aside className="w-full lg:w-[400px] p-4 lg:p-8 bg-slate-950 border-l border-slate-900 sticky top-0 h-fit lg:h-screen lg:overflow-y-auto">
        <div className="space-y-8">
          <PredictionSlip
            items={slip}
            balance={balanceNum}
            placing={placing}
            ghostMode={!!profile?.ghostMode}
            onStake={(id, stake) => setSlip((p) => p.map((i) => (i.outcomeId === id ? { ...i, stake, error: undefined } : i)))}
            onRemove={(id) => setSlip((p) => p.filter((i) => i.outcomeId !== id))}
            onClear={() => setSlip([])}
            onPlace={handlePlace}
          />
          <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-6 text-center">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">How it works</p>
            <p className="text-[10px] text-slate-400 leading-relaxed mt-3 uppercase">Free points - real race results - weekly leaderboard</p>
          </div>
          <InstallCard />
        </div>
      </aside>

      {isAccountOpen && profile && (
        <AccountModal
          profile={profile} wagers={wagers} ledger={ledger}
          onClose={() => setIsAccountOpen(false)}
          onSignOut={() => signOut()}
          onToggleGhost={toggleGhost}
        />
      )}
      {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} onAuthed={onAuthed} />}

      {toast && (
        <div role="status" className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] max-w-[90%] px-4 py-3 rounded-xl text-xs font-bold shadow-2xl border ${toast.kind === 'ok' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100' : 'bg-red-950/90 border-red-500/40 text-red-100'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
};

export default App;
