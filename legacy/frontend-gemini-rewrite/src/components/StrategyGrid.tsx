import React from 'react';

export default function StrategyGrid({ drivers, onBetSelect }: { drivers: any[], onBetSelect: any }) {
  return (
    <div className="grid gap-3 p-4">
      {drivers.map(driver => (
        <div key={driver.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-3">
             <span className="font-racing font-bold text-white italic">{driver.name}</span>
             <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase font-black">{driver.team}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onBetSelect(driver, 'interval')} className="bg-slate-950 border border-indigo-500/30 p-2 rounded text-[10px] text-indigo-300 font-bold hover:bg-indigo-900/20">
               {driver.markets.interval.label} <br/> <span className="text-white font-racing">{driver.markets.interval.odds}</span>
            </button>
            <button onClick={() => onBetSelect(driver, 'joker')} className="bg-slate-950 border border-yellow-500/30 p-2 rounded text-[10px] text-yellow-300 font-bold hover:bg-yellow-900/20">
               {driver.markets.joker.label} <br/> <span className="text-white font-racing">{driver.markets.joker.odds}</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
