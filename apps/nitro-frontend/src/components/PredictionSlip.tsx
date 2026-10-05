import React from 'react';
import { SlipItem } from '../types';
import { fmtPts } from '../api';

interface Props {
  items: SlipItem[];
  balance: number | null;       // null = not signed in
  placing: boolean;
  ghostMode: boolean;
  onStake: (outcomeId: string, stake: number) => void;
  onRemove: (outcomeId: string) => void;
  onClear: () => void;
  onPlace: () => void;
}

const trendColor = (t: SlipItem['trend']) => (t === 'up' ? 'border-red-500' : t === 'down' ? 'border-green-500' : 'border-slate-500');

const PredictionSlip: React.FC<Props> = ({ items, balance, placing, ghostMode, onStake, onRemove, onClear, onPlace }) => {
  const total = items.reduce((a, i) => a + i.stake, 0);
  const potential = items.reduce((a, i) => a + i.stake * i.odds, 0);
  const insufficient = balance !== null && total > balance;

  if (items.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
        <div className="text-4xl mb-4 opacity-50">🎟️</div>
        <p className="text-slate-400 font-racing uppercase text-xs tracking-widest">Your Prediction Slip is Empty</p>
        <p className="text-slate-600 text-xs mt-2">Pick a driver to start your engines.</p>
      </div>
    );
  }

  const label = balance === null ? 'SIGN IN TO PREDICT' : placing ? 'LOCKING IN...' : insufficient ? 'NOT ENOUGH POINTS' : ghostMode ? 'LOCK IN (GHOST)' : 'LOCK IN PREDICTIONS';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="bg-red-600 p-3 flex justify-between items-center">
        <h3 className="font-racing text-sm font-bold tracking-tighter italic">PREDICTION SLIP ({items.length})</h3>
        <button onClick={onClear} disabled={placing} className="text-[10px] uppercase font-bold text-white/80 hover:text-white transition-colors">Clear All</button>
      </div>

      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
        {items.map((it) => (
          <div key={it.outcomeId} className={`bg-slate-800/50 rounded-lg p-3 border-l-4 ${trendColor(it.trend)} relative`}>
            <button onClick={() => onRemove(it.outcomeId)} disabled={placing} className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors" aria-label="Remove">✕</button>
            <div className="flex justify-between items-start mb-2 pr-6">
              <div>
                <p className="text-xs font-bold text-white">{it.label} {ghostMode && <span title="Ghost mode on">👻</span>}</p>
                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{it.marketTitle}</p>
              </div>
              <span className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-xs font-bold text-red-400 shadow-inner">{it.odds.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
              <label className="flex items-center gap-2 text-[10px] text-slate-400 uppercase">
                Points
                <input
                  type="number" min={1} value={it.stake} disabled={placing}
                  onChange={(e) => onStake(it.outcomeId, Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none focus:border-red-500"
                />
              </label>
              <span className="text-[10px] text-green-400 font-bold uppercase">Win: {fmtPts(it.stake * it.odds)}</span>
            </div>
            {it.error && <p className="mt-2 text-[10px] text-red-400 font-bold italic">{it.error}</p>}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">Total points</span>
          <span className="text-white font-bold">{fmtPts(total)}</span>
        </div>
        <div className="flex justify-between text-sm mb-4">
          <span className="text-slate-400">Est. return</span>
          <span className="text-green-500 font-black tracking-tight">{fmtPts(potential)}</span>
        </div>
        <button
          onClick={onPlace}
          disabled={placing || insufficient}
          className={`w-full py-4 rounded-lg font-racing text-sm font-black transition-all transform active:scale-95 ${
            placing || insufficient ? 'bg-slate-700 cursor-not-allowed' : ghostMode ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-red-600 hover:bg-red-500 glow-red'
          }`}
        >
          {label}
        </button>
      </div>
    </div>
  );
};

export default PredictionSlip;
