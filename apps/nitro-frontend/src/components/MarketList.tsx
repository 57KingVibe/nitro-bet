import React from 'react';
import { Market } from '../api';

interface Props { markets: Market[]; onOpen: (marketId: string) => void }

const closesText = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);

/** One tappable card per market. The odds, the chart and the picks live on the market's own page. */
const MarketList: React.FC<Props> = ({ markets, onOpen }) => (
  <section className="space-y-3">
    <h2 className="font-racing text-lg font-black uppercase tracking-widest flex items-center gap-2"><span className="w-1 h-6 bg-red-600"></span> Markets</h2>
    {markets.map((m) => {
      const fav = m.outcomes.reduce((a, b) => (Number(b.odds) < Number(a.odds) ? b : a), m.outcomes[0]);
      const open = m.status === 'open';
      const closes = closesText(m.closesAt);
      return (
        <button key={m.id} type="button" onClick={() => onOpen(m.id)}
          className="w-full text-left bg-slate-900 border border-slate-800 hover:border-red-500/50 rounded-2xl p-4 transition-all shadow-lg active:scale-[0.99]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-racing text-sm font-black uppercase tracking-wide text-white leading-snug">{m.title}</p>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">
                {m.outcomes.length} choices{closes ? ` · closes ${closes}` : ''}
              </p>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest ${open ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'}`}>
              {open ? 'Open' : 'Closed'}
            </span>
          </div>
          {fav && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-400 truncate pr-3">Favourite <b className="text-white">{fav.label}</b></span>
              <span className="font-racing font-black text-red-400">{Number(fav.odds).toFixed(2)}</span>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span>{m.model === 'pool' ? 'Live odds + chart' : 'Fixed odds'}</span>
            <span className="text-red-500">{open ? 'Predict →' : 'View →'}</span>
          </div>
        </button>
      );
    })}
  </section>
);

export default MarketList;
