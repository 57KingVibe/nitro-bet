import React from 'react';

const FAST_MARKETS = [
  { id: '1', label: 'Next to Pit', driver: 'Verstappen', odds: 1.85 },
  { id: '2', label: 'Fastest Lap', driver: 'Norris', odds: 3.20 },
  { id: '3', label: 'Safety Car', driver: 'Any', odds: 5.50 },
  { id: '4', label: 'Sector 1 Purple', driver: 'Hamilton', odds: 2.10 },
];

export default function ActionGrid() {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-6">
      
      {/* Instant Tap Markets - 2 Column Grid */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-black text-lg text-white">Flash Markets</h2>
          <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-1 rounded font-bold uppercase">Closes Soon</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {FAST_MARKETS.map(market => (
            <button key={market.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col active:bg-slate-800 transition-colors text-left">
              <span className="text-[11px] text-slate-400 font-semibold">{market.label}</span>
              <span className="font-bold text-white text-sm mt-0.5 truncate">{market.driver}</span>
              <div className="mt-2 w-full flex justify-between items-center">
                <span className="text-red-500 text-[10px] font-black">📈 LIVE</span>
                <span className="bg-slate-950 text-indigo-400 px-2 py-1 rounded font-racing text-sm font-bold border border-indigo-500/20">{market.odds.toFixed(2)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Race Winner - High Contrast List */}
      <div>
        <h3 className="font-black text-lg text-white mb-3">Race Winner</h3>
        <div className="space-y-2">
          {['Max Verstappen', 'Lando Norris', 'Lewis Hamilton'].map((driver, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-800 bg-slate-900 active:bg-slate-800 transition-colors">
              <div className="flex flex-col">
                <span className="font-bold text-white">{driver}</span>
                <span className="text-[10px] text-slate-400">Outright Winner</span>
              </div>
              <button className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-racing text-lg font-bold shadow-md active:scale-95 transition-transform">
                {(1.5 + i).toFixed(2)}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
