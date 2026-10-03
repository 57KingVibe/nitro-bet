import React, { useState, useEffect } from 'react';

export default function VaultModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  // Simulate live fluctuating cash out value
  const [availableReturn, setAvailableReturn] = useState(385.40);
  const stakeAmount = 100;
  const potentialWin = 450;

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setAvailableReturn(prev => {
        // Randomly fluctuate the cash out value by a few dollars to simulate live telemetry shifting
        const change = (Math.random() - 0.5) * 8; 
        return Math.max(stakeAmount * 0.5, Math.min(potentialWin * 0.95, prev + change));
      });
    }, 1500); // Updates every 1.5 seconds
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 w-full sm:w-[400px] h-[85vh] sm:h-auto rounded-t-3xl sm:rounded-3xl border border-slate-800 flex flex-col animate-slide-in relative overflow-hidden">
        
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
           <div>
              <h2 className="font-racing text-xl font-black italic text-white">THE <span className="text-indigo-500">VAULT</span></h2>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Active Stakes & Returns</p>
           </div>
           <button onClick={onClose} className="text-slate-500 font-black text-xl active:scale-90">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           {/* Active Stake Card */}
           <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-4 relative overflow-hidden shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <div className="absolute top-0 right-4 -mt-1 bg-red-600 text-[8px] font-black px-2 py-1 rounded-b-lg uppercase italic text-white">LIVE EVENT</div>
              
              <div className="mb-4 pt-2">
                 <h4 className="font-racing text-sm font-bold text-white uppercase italic">Lewis Hamilton</h4>
                 <p className="text-[10px] text-slate-400 uppercase font-black">Sector Dominance: Laps 1-7</p>
              </div>

              <div className="flex justify-between items-end border-b border-slate-800 pb-3 mb-3">
                 <div>
                    <p className="text-[8px] text-slate-500 uppercase font-black">Stake</p>
                    <p className="text-sm font-bold text-white">${stakeAmount.toFixed(2)}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[8px] text-slate-500 uppercase font-black">To Return</p>
                    <p className="text-sm font-racing font-bold text-slate-300">${potentialWin.toFixed(2)}</p>
                 </div>
              </div>

              {/* The "Available Return" Cash Out Engine */}
              <div className="flex justify-between items-center bg-green-500/5 border border-green-500/20 p-3 rounded-lg">
                 <div>
                    <p className="text-[9px] text-green-500 uppercase font-black tracking-widest flex items-center gap-1">
                       <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                       Available Return
                    </p>
                    <p className="font-racing text-xl font-black text-green-400">${availableReturn.toFixed(2)}</p>
                 </div>
                 <button className="bg-green-600 hover:bg-green-500 text-white font-racing font-black italic text-xs px-4 py-2.5 rounded-lg shadow-[0_0_10px_rgba(34,197,94,0.3)] active:scale-95 transition-all">
                    CASH OUT
                 </button>
              </div>
           </div>

           {/* Resolved Stake Example */}
           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 opacity-70">
              <div className="flex justify-between items-start mb-2">
                 <div>
                    <h4 className="font-racing text-xs font-bold text-slate-300 uppercase italic">Lando Norris</h4>
                    <p className="text-[9px] text-slate-500 uppercase font-black">Fastest Lap</p>
                 </div>
                 <span className="text-[9px] bg-slate-800 text-slate-400 font-black px-2 py-0.5 rounded uppercase">Lost</span>
              </div>
              <div className="flex justify-between items-end border-t border-slate-800 pt-2 mt-1">
                 <p className="text-xs font-bold text-slate-500">$50.00 @ 3.20</p>
                 <p className="text-xs font-racing font-bold text-slate-500">$0.00</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
