import React, { useState } from 'react';
import { Driver } from '../types';
export default function DriverCard({ driver, onBet }: { driver: Driver, onBet: (d: Driver, s: number) => void }) {
  const [stake, setStake] = useState('100');
  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div><h3 className="text-xl font-black font-racing italic">{driver.name}</h3><p className="text-[10px] text-slate-500 uppercase">{driver.team}</p></div>
        <span className="text-[10px] px-2 py-0.5 rounded font-black uppercase bg-slate-800 text-slate-400">{driver.trend}</span>
      </div>
      <div className="mt-4 flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
        <div><p className="text-[8px] text-slate-500 font-black">ODDS</p><p className="text-2xl font-racing text-red-500">{driver.odds.toFixed(2)}x</p></div>
        <div className="flex gap-2"><input type="number" value={stake} onChange={e => setStake(e.target.value)} className="w-16 bg-slate-950 border border-slate-800 text-xs p-2 rounded" /><button onClick={() => onBet(driver, Number(stake))} className="bg-red-600 text-[10px] font-black px-3 py-2 rounded">BET</button></div>
      </div>
    </div>
  );
}
