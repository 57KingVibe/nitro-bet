import React from 'react';
import { Bet } from '../types';
export default function BetSlip({ bets, onClear }: { bets: Bet[], onClear: () => void }) {
  if (!bets.length) return <div className="border border-dashed border-slate-800 p-6 rounded-xl text-center text-xs text-slate-600 uppercase font-black">NO ACTIVE STAKES</div>;
  return (
    <div className="space-y-4"><div className="flex justify-between"><h3 className="text-xs text-slate-400 font-black">SLIP</h3><button onClick={onClear} className="text-[9px] text-red-500">CLEAR</button></div>
      {bets.map(b => (
        <div key={b.id} className="bg-slate-900 p-3 rounded-xl border border-slate-800">
          <p className="font-black text-sm">{b.driverName}</p><p className="text-[10px] text-red-500 font-racing">{b.odds}x | Stake: ${b.stake}</p>
        </div>
      ))}
    </div>
  );
}
