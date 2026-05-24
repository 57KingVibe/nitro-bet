import React, { useState, useEffect } from 'react';

export default function BetSlipModal({ isOpen, onClose, betCount }: { isOpen: boolean, onClose: () => void, betCount: number }) {
  const [stake, setStake] = useState('10');
  const [displayReturn, setDisplayReturn] = useState(0);
  const [isGhostMode, setIsGhostMode] = useState(false);
  
  const odds = 3.20; 
  const targetReturn = parseFloat(stake.replace(/,/g, '') || '0') * odds;

  // Animate the "To Return" counter
  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    const duration = 300; // ms
    const startValue = displayReturn;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function for smoother counter
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = startValue + (targetReturn - startValue) * easeOutQuart;
      
      setDisplayReturn(current);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setDisplayReturn(targetReturn);
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [targetReturn]);

  const handleStakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip non-digits, allow empty
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    if (!rawValue) {
        setStake('');
        return;
    }
    // Format with commas
    const formatted = parseInt(rawValue, 10).toLocaleString('en-US');
    setStake(formatted);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      
      <div className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-slate-800 rounded-t-3xl z-[100] animate-slide-in pb-safe">
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-black text-white text-lg">Current Slip <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full ml-2">{betCount}</span></h2>
            <button onClick={onClose} className="text-slate-500 font-black text-lg active:scale-90">✕</button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-4 relative overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isGhostMode ? 'bg-indigo-500' : 'bg-red-600'}`}></div>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fastest Lap</p>
                <p className="font-bold text-white text-sm">Lando Norris</p>
              </div>
              <span className="bg-slate-900 text-indigo-400 px-2 py-1 rounded font-racing text-sm font-bold border border-indigo-500/20">{odds.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center px-4 focus-within:border-indigo-500 transition-colors">
              <span className="text-slate-500 font-bold">$</span>
              <input 
                type="text" 
                inputMode="numeric"
                value={stake}
                onChange={handleStakeChange}
                className="w-full bg-transparent text-white font-racing text-xl font-bold p-2 outline-none"
                placeholder="0"
              />
            </div>
            <div className="flex flex-col justify-center items-end px-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase">To Return</span>
              <span className="text-green-400 font-racing text-xl font-black">${displayReturn.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {['5', '10', '50', 'MAX'].map(val => (
              <button 
                key={val} 
                onClick={() => setStake(val === 'MAX' ? '1,000' : val)}
                className="bg-slate-800 text-slate-300 font-bold py-2 rounded-lg text-xs active:bg-slate-700 transition-colors"
              >
                {val === 'MAX' ? val : `$${val}`}
              </button>
            ))}
          </div>
          
          {/* Ghost Mode Toggle */}
          <div className="flex items-center justify-between mb-6 px-1">
             <div className="flex items-center gap-2">
                <span className="text-xl">{isGhostMode ? '🥷' : '👁️'}</span>
                <div>
                   <p className="text-xs font-bold text-white">Ghost Mode</p>
                   <p className="text-[9px] text-slate-500 uppercase">Route via E2EE network</p>
                </div>
             </div>
             <button 
                onClick={() => setIsGhostMode(!isGhostMode)}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${isGhostMode ? 'bg-indigo-600' : 'bg-slate-700'}`}
             >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isGhostMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
             </button>
          </div>

          <button className={`w-full text-white font-racing font-black text-xl italic py-4 rounded-xl active:scale-95 transition-all shadow-lg ${isGhostMode ? 'bg-indigo-600 shadow-indigo-600/30' : 'bg-red-600 glow-red'}`}>
            {isGhostMode ? 'LOCK ANONYMOUS' : 'LOCK IN STAKES'}
          </button>
        </div>
      </div>
    </>
  );
}
