import React from 'react';

export const TopNav = ({ onLoginClick }: { onLoginClick: () => void }) => (
  <div className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40">
    <div className="flex items-center justify-between px-4 py-3">
      <h1 className="font-racing text-xl font-black italic uppercase text-white">Nitro<span className="text-red-600">Bet</span></h1>
      <div className="flex gap-3">
        <button onClick={onLoginClick} className="text-xs font-bold text-slate-300">Login</button>
        <button onClick={onLoginClick} className="text-xs font-black bg-red-600 text-white px-4 py-1.5 rounded shadow-lg shadow-red-600/20 active:scale-95">Register</button>
      </div>
    </div>
    <div className="flex overflow-x-auto px-4 py-2 gap-6 no-scrollbar border-t border-slate-800/50">
      {['🔥 LIVE', 'Today', 'F1', 'WRC', 'MotoGP', 'GT Racing'].map((item, i) => (
        <button key={i} className={`whitespace-nowrap text-[11px] font-black uppercase tracking-widest ${i === 0 ? 'text-red-500' : 'text-slate-400'}`}>
          {item}
        </button>
      ))}
    </div>
  </div>
);

export const BottomNav = ({ betCount, onSlipClick, onProfileClick }: { betCount: number, onSlipClick: () => void, onProfileClick: () => void }) => (
  <nav className="fixed bottom-0 w-full bg-slate-950 border-t border-slate-800 pb-safe pt-2 px-6 flex justify-between items-center h-16 z-50">
    <button className="flex flex-col items-center gap-1 text-red-500">
      <span className="text-xl">🏠</span><span className="text-[9px] font-bold uppercase">Home</span>
    </button>
    <button className="flex flex-col items-center gap-1 text-slate-500">
      <span className="text-xl">⚡</span><span className="text-[9px] font-bold uppercase">Live</span>
    </button>
    <button onClick={onSlipClick} className="flex flex-col items-center gap-1 relative text-slate-500 active:scale-90 transition-transform">
      <div className="relative">
        <span className="text-xl">📄</span>
        {betCount > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-pulse">{betCount}</span>}
      </div>
      <span className="text-[9px] font-bold uppercase">Betslip</span>
    </button>
    <button onClick={onProfileClick} className="flex flex-col items-center gap-1 text-slate-500 active:scale-90 transition-transform">
      <span className="text-xl">👤</span><span className="text-[9px] font-bold uppercase">Me</span>
    </button>
  </nav>
);
