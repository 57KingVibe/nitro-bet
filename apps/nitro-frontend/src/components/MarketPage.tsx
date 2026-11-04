import React from 'react';
import { Driver } from '../types';
import { Market } from '../api';
import DriverCard from './DriverCard';
import MarketChart from './MarketChart';

export type SortOrder = 'none' | 'asc' | 'desc';
export type MarketTab = 'odds' | 'chart';

interface Props {
  market: Market;
  cards: Driver[];
  sortOrder: SortOrder;
  onSort: (s: SortOrder) => void;
  tab: MarketTab;
  onTab: (t: MarketTab) => void;
  onBack: () => void;
  onBet: (driver: Driver, stake: number) => void;
}

const seg = (on: boolean) => `px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${on ? 'bg-slate-800 text-white shadow' : 'text-slate-500'}`;

/** A single market on its own page: the odds cards and, for pool markets, the price chart on a second tab. */
const MarketPage: React.FC<Props> = ({ market, cards, sortOrder, onSort, tab, onTab, onBack, onBet }) => {
  const open = market.status === 'open';
  const hasChart = market.model === 'pool';
  const list = [...cards];
  if (sortOrder === 'asc') list.sort((a, b) => a.odds - b.odds);
  if (sortOrder === 'desc') list.sort((a, b) => b.odds - a.odds);

  return (
    <section>
      <button type="button" onClick={onBack} className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white">← All markets</button>

      <div className="mb-5">
        <h2 className="font-racing text-lg font-black uppercase tracking-widest flex items-center gap-2"><span className="w-1 h-6 bg-red-600"></span> {market.title}</h2>
        {market.closesAt && <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 ml-3">{open ? 'Closes' : 'Closed'} {new Date(market.closesAt).toLocaleString()}</p>}
      </div>

      {!open && (
        <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs font-bold text-yellow-300">
          Predictions are closed. The result is added after the race and points are paid out automatically.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {hasChart ? (
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800" role="tablist">
            <button role="tab" aria-selected={tab === 'odds'} onClick={() => onTab('odds')} className={seg(tab === 'odds')}>Odds</button>
            <button role="tab" aria-selected={tab === 'chart'} onClick={() => onTab('chart')} className={seg(tab === 'chart')}>Chart</button>
          </div>
        ) : <span></span>}
        {tab === 'odds' && (
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onClick={() => onSort('none')} className={seg(sortOrder === 'none')}>Default</button>
            <button onClick={() => onSort('asc')} className={seg(sortOrder === 'asc')}>Lowest</button>
            <button onClick={() => onSort('desc')} className={seg(sortOrder === 'desc')}>Highest</button>
          </div>
        )}
      </div>

      {tab === 'chart' && hasChart ? (
        <MarketChart market={market} />
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${open ? '' : 'pointer-events-none opacity-60'}`}>
          {list.map((driver) => <DriverCard key={driver.id} driver={driver} onBet={onBet} />)}
        </div>
      )}
    </section>
  );
};

export default MarketPage;
