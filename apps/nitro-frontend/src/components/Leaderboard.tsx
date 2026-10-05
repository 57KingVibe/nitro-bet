import React, { useEffect, useState } from 'react';
import { api, Leaderboard as LB, MyRank, fmtPts } from '../api';

/** Pure view, so it can be tested without a server. */
export const LeaderboardView: React.FC<{ data: LB | null; failed: boolean; period: 'week' | 'all'; mine: MyRank | null; now?: number }> = ({ data, failed, period, mine, now = Date.now() }) => {
  const resets = (() => {
    if (!data?.endsAt) return '';
    const ms = new Date(data.endsAt).getTime() - now;
    if (ms <= 0) return 'Resetting...';
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
    return `Resets in ${d}d ${h}h`;
  })();

  if (!data) {
    return <p className="text-xs text-slate-500 italic py-6 text-center">{failed ? 'Leaderboard offline - retrying...' : 'Loading leaderboard...'}</p>;
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
        <span>{period === 'week' ? resets : 'Since launch'}</span>
        <span>{data.prizesEnabled ? 'Weekly prizes on' : 'Prizes: coming soon'}</span>
      </div>
      {data.entries.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-6 text-center">No settled predictions yet. Make a pick and be first on the board.</p>
      ) : (
        <ol className="space-y-1.5">
          {data.entries.map((e) => (
            <li key={e.rank} className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
              <span className="flex items-center gap-3 min-w-0">
                <span className={`w-6 text-center font-racing font-black ${e.rank === 1 ? 'text-yellow-400' : e.rank === 2 ? 'text-slate-300' : e.rank === 3 ? 'text-orange-400' : 'text-slate-500'}`}>{e.rank}</span>
                <span className="text-xs font-bold text-white truncate">{e.name}</span>
              </span>
              <span className="text-right">
                <span className={`block text-xs font-racing font-black ${e.netMinor >= 0 ? 'text-green-400' : 'text-red-400'}`}>{e.netMinor >= 0 ? '+' : ''}{fmtPts(e.net)}</span>
                <span className="block text-[8px] text-slate-600 uppercase font-black">{e.predictions} settled</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {mine && (
        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
          {mine.ranked ? `Your rank: #${mine.rank} (${Number(mine.net) >= 0 ? '+' : ''}${fmtPts(mine.net ?? 0)})` : 'Settle a prediction to get ranked'}
        </p>
      )}
    </div>
  );
};

const Leaderboard: React.FC<{ loggedIn: boolean; refreshKey: number }> = ({ loggedIn, refreshKey }) => {
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [data, setData] = useState<LB | null>(null);
  const [mine, setMine] = useState<MyRank | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const [lb, me] = await Promise.all([api.leaderboard(period), loggedIn ? api.myRank(period).catch(() => null) : Promise.resolve(null)]);
        if (!cancelled) { setData(lb); setMine(me); setFailed(false); }
      } catch { if (!cancelled) setFailed(true); }
      finally { if (!cancelled) timer = setTimeout(load, 60000); }
    };
    setData(null);
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [period, loggedIn, refreshKey]);

  return (
    <section className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-racing text-lg font-black uppercase tracking-widest flex items-center gap-2"><span className="w-1 h-6 bg-red-600"></span> Top Predictors</h2>
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button onClick={() => setPeriod('week')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${period === 'week' ? 'bg-slate-800 text-white shadow' : 'text-slate-500'}`}>This week</button>
          <button onClick={() => setPeriod('all')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${period === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-500'}`}>All time</button>
        </div>
      </div>
      <LeaderboardView data={data} failed={failed} period={period} mine={mine} />
    </section>
  );
};

export default Leaderboard;
