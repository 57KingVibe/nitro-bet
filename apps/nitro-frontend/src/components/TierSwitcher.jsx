import React, { useState } from 'react';

export default function TierSwitcher() {
  const [activeTier, setActiveTier] = useState('lite');

  return (
    <div className="flex flex-col items-center p-6 bg-slate-900 rounded-xl border border-slate-800 my-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-black text-white mb-4">SELECT YOUR ARENA</h2>
      
      <div className="flex gap-4 mb-6 w-full justify-center">
        <button 
          onClick={() => setActiveTier('lite')}
          className={`px-6 py-3 rounded-lg font-bold transition-all w-1/2 ${
            activeTier === 'lite' 
              ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.5)]' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          LITE (FREE)
        </button>
        
        <button 
          onClick={() => setActiveTier('normal')}
          className={`px-6 py-3 rounded-lg font-bold transition-all w-1/2 ${
            activeTier === 'normal' 
              ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          NORMAL (18+)
        </button>
      </div>
      
      <div className="text-center p-4 bg-black/50 rounded-lg w-full h-24 flex items-center justify-center">
        {activeTier === 'lite' ? (
          <p className="text-green-400 font-medium">
            🚀 Share your link! Earn a $5 bonus for every referral. No crypto required.
          </p>
        ) : (
          <p className="text-red-400 font-medium">
            ⚡ Real EVM Staking. Automated 20% Loss-Cashback Protection Active.
          </p>
        )}
      </div>
    </div>
  );
}
