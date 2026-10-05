
import React, { useState } from 'react';
import { Bet, BetType } from '../types';

interface BetSlipProps {
  bets: Bet[];
  onRemoveBet: (id: string) => void;
  onUpdateBetType?: (id: string, type: BetType) => void;
  onToggleAnonymous?: (id: string) => void;
  onClear: () => void;
  onPlace: () => void;
  balance: number;
  ghostMode?: boolean;
}

const BetSlip: React.FC<BetSlipProps> = ({ bets, onRemoveBet, onUpdateBetType, onToggleAnonymous, onClear, onPlace, balance, ghostMode }) => {
  const [isPlacing, setIsPlacing] = useState(false);
  const totalStake = bets.reduce((acc, bet) => acc + bet.stake, 0);
  const potentialWin = bets.reduce((acc, bet) => acc + bet.toWin, 0);

  const anonymous = bets.some(b => b.isAnonymous) || !!ghostMode;
  const insufficient = totalStake > balance;

  const handlePlaceBet = () => {
    if (bets.length === 0 || isPlacing || insufficient) return;
    setIsPlacing(true);
    setTimeout(() => {
      setIsPlacing(false);
      onPlace();
    }, 1500);
  };

  const renderTrendIcon = (trend: Bet['trend'], size: 'sm' | 'xs' = 'sm') => {
    const fontSize = size === 'xs' ? 'text-[8px]' : 'text-[10px]';
    switch (trend) {
      case 'up':
        return <span className={`text-green-500 ${fontSize}`} title="Trend: Up">▲</span>;
      case 'down':
        return <span className={`text-red-500 ${fontSize}`} title="Trend: Down">▼</span>;
      case 'stable':
      default:
        return <span className={`text-slate-500 ${fontSize}`} title="Trend: Stable">■</span>;
    }
  };

  const getTrendColor = (trend: Bet['trend']) => {
    switch (trend) {
      case 'up': return 'border-green-500';
      case 'down': return 'border-red-500';
      default: return 'border-slate-500';
    }
  };

  const betTypes: BetType[] = ['Race Winner', 'Podium Finish', 'Fastest Lap'];

  if (bets.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
        <div className="text-4xl mb-4 opacity-50">🎟️</div>
        <p className="text-slate-400 font-racing uppercase text-xs tracking-widest">Your Bet Slip is Empty</p>
        <p className="text-slate-600 text-xs mt-2">Select odds to start your engines.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="bg-red-600 p-3 flex justify-between items-center">
        <h3 className="font-racing text-sm font-bold tracking-tighter italic">BET SLIP ({bets.length})</h3>
        <button onClick={onClear} className="text-[10px] uppercase font-bold text-white/80 hover:text-white transition-colors">Clear All</button>
      </div>
      
      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
        {bets.map((bet) => (
          <div key={bet.id} className={`bg-slate-800/50 rounded-lg p-3 border-l-4 ${getTrendColor(bet.trend)} relative group transition-all ${bet.isAnonymous ? 'ring-1 ring-indigo-500/50' : ''}`}>
            <button 
              onClick={() => onRemoveBet(bet.id)}
              className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
            >
              ✕
            </button>
            <div className="flex justify-between items-start mb-2 pr-6">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-white">{bet.driverName}</p>
                  
                  {/* Trend History Display */}
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-950 rounded border border-slate-700/50 ml-1">
                    {bet.trendHistory?.map((h, i) => (
                      <div key={i} className={`flex items-center ${i === 0 ? 'opacity-100 scale-110' : i === 1 ? 'opacity-60 scale-90' : 'opacity-30 scale-75'}`}>
                        {renderTrendIcon(h, 'xs')}
                      </div>
                    ))}
                    {!bet.trendHistory && renderTrendIcon(bet.trend)}
                  </div>

                  {bet.isAnonymous && <span className="text-[10px] text-indigo-400" title="Anonymous Stake">👻</span>}
                </div>
                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Target Selection</p>
              </div>
              <span className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-xs font-bold text-red-400 shadow-inner">
                {bet.odds.toFixed(2)}
              </span>
            </div>

            {/* Bet Type Selector */}
            <div className="flex bg-slate-950 rounded-md p-0.5 mb-3 border border-slate-800 shadow-lg">
              {betTypes.map(type => (
                <button
                  key={type}
                  onClick={() => onUpdateBetType?.(bet.id, type)}
                  className={`flex-1 text-[8px] py-1 px-1 rounded transition-all font-bold uppercase tracking-tighter ${
                    bet.betType === type 
                    ? 'bg-slate-800 text-white shadow shadow-black/50 border border-slate-700' 
                    : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  {type.split(' ')[0]}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-slate-400 uppercase">Stake: <span className="text-white">${bet.stake}</span></span>
                {/* Anonymous Toggle */}
                <button 
                  onClick={() => onToggleAnonymous?.(bet.id)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${bet.isAnonymous ? 'bg-indigo-900/40 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-400'}`}
                >
                  <span className="text-[8px] font-black uppercase tracking-tighter">Ghost</span>
                  <div className={`w-2 h-2 rounded-full ${bet.isAnonymous ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                </button>
              </div>
              <span className="text-[10px] text-green-400 font-bold uppercase">Win: <span className="text-green-400">${bet.toWin.toFixed(2)}</span></span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">Total Stake</span>
          <span className="text-white font-bold">${totalStake.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm mb-4">
          <span className="text-slate-400">Est. Return</span>
          <span className="text-green-500 font-black tracking-tight">${potentialWin.toFixed(2)}</span>
        </div>
        
        <button 
          onClick={handlePlaceBet}
          disabled={isPlacing || insufficient}
          className={`w-full py-4 rounded-lg font-racing text-sm font-black transition-all transform active:scale-95 ${
            isPlacing || insufficient ? 'bg-slate-700 cursor-not-allowed' : anonymous ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-red-600 hover:bg-red-500 glow-red'
          }`}
        >
          {isPlacing ? 'LOCKING IN...' : insufficient ? 'INSUFFICIENT BALANCE' : anonymous ? 'LOCK ANONYMOUS' : 'PLACE BETS NOW'}
        </button>
      </div>
    </div>
  );
};

export default BetSlip;
