import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

interface Feed {
  source: string;
  updatedAt: string;
  stale?: boolean;
  trackConditions: { tempC: number; airTempC: number; rainfall: number } | null;
  leaderboard: { position: number; driverNumber: number; name: string; team: string | null }[];
}

const POLL_MS = 15000;      // the API caches upstream data for 15s
const TIMEOUT_MS = 60000;   // a sleeping free-tier server can take ~50s to wake

const LiveTelemetry: React.FC = () => {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      const ctrl = new AbortController();
      const abort = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/unified`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data: Feed = await res.json();
        if (!cancelled) { setFeed(data); setFailed(false); }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        clearTimeout(abort);
        if (!cancelled) timer = setTimeout(load, POLL_MS);
      }
    };

    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const skeleton = (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-slate-800 rounded w-full"></div>
      <div className="h-3 bg-slate-800 rounded w-4/5"></div>
      <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest pt-1">
        {failed ? 'Telemetry offline - retrying...' : 'Connecting to telemetry server...'}
      </p>
    </div>
  );

  const tc = feed?.trackConditions;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-xs">📡</div>
            <h2 className="font-racing text-[10px] font-bold uppercase tracking-widest text-indigo-400">Live Telemetry</h2>
          </div>
          <span className="text-[8px] bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300">{feed?.stale ? 'STALE' : 'OPENF1'}</span>
        </div>
        {!feed ? skeleton : tc ? (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
              <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Track</p>
              <p className="text-lg font-racing font-black text-white">{tc.tempC}°C</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
              <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Air</p>
              <p className="text-lg font-racing font-black text-white">{tc.airTempC}°C</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
              <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Track</p>
              <p className="text-lg font-racing font-black text-white">{tc.rainfall > 0 ? 'Wet' : 'Dry'}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No weather data for the latest session.</p>
        )}
      </div>

      <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center text-xs">🏁</div>
            <h2 className="font-racing text-[10px] font-bold uppercase tracking-widest text-emerald-400">Grid Leaders</h2>
          </div>
          <span className="text-[8px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">LATEST SESSION</span>
        </div>
        {!feed ? skeleton : feed.leaderboard.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No positions published yet.</p>
        ) : (
          <ol className="space-y-1.5">
            {feed.leaderboard.slice(0, 5).map(d => (
              <li key={d.driverNumber} className="flex items-center justify-between text-xs border-b border-slate-800/60 last:border-0 pb-1.5 last:pb-0">
                <span className="font-bold text-white"><span className="text-emerald-400 font-racing mr-2">{d.position}</span>{d.name}</span>
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest truncate max-w-[40%]">{d.team}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

export default LiveTelemetry;
