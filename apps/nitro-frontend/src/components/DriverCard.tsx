
import React, { useState } from 'react';
import { Driver } from '../types';

interface DriverCardProps {
  driver: Driver;
  onBet: (driver: Driver, stake: number) => void;
}

const DriverCard: React.FC<DriverCardProps> = ({ driver, onBet }) => {
  const [stake, setStake] = useState<number>(100);

  const handleBetClick = () => {
    if (stake > 0) {
      onBet(driver, stake);
    }
  };

  const diff = driver.odds - driver.lastOdds;
  const percentChange = (diff / driver.lastOdds) * 100;
  const isOddsShortening = diff < 0; // Lower odds = more likely/favored
  const isOddsDrifting = diff > 0;    // Higher odds = less favored

  // Calculate intensity for the background glow based on odds.
  // Favorites (odds ~1.0) have high intensity. Long shots (odds > 20) have low intensity.
  const intensity = Math.max(0, Math.min(1, (20 - driver.odds) / 19));

  const renderNameTrend = () => {
    switch (driver.trend) {
      case 'up':
        return <span className="text-red-500 text-[10px] animate-bounce" title="Odds Drifting (Up)">▲</span>;
      case 'down':
        return <span className="text-green-500 text-[10px] animate-bounce" title="Odds Shortening (Down)">▼</span>;
      default:
        return <span className="text-slate-600 text-[10px]" title="Odds Stable">▬</span>;
    }
  };

  return (
    <div 
      className="group relative border border-slate-800 rounded-xl p-4 transition-all hover:border-red-500/50 overflow-hidden shadow-lg"
      style={{
        background: `radial-gradient(circle at 70% -20%, rgba(220, 38, 38, ${intensity * 0.15}), transparent), #0f172a`,
      }}
    >
      {/* Carbon Fiber Pattern Overlay (Subtle) */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none carbon-bg"></div>

      {/* Dynamic Trend Overlay */}
      <div className="absolute top-0 right-0 p-2 z-10">
        {driver.trend === 'up' && (
          <div className="flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
            <span className="text-red-500 animate-pulse text-[10px]">▲</span>
            <span className="text-red-400 text-[8px] font-black uppercase">Drifting</span>
          </div>
        )}
        {driver.trend === 'down' && (
          <div className="flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
            <span className="text-green-500 animate-pulse text-[10px]">▼</span>
            <span className="text-green-400 text-[8px] font-black uppercase">Shortening</span>
          </div>
        )}
      </div>

      <div className="flex gap-4 items-center flex-wrap sm:flex-nowrap relative z-10">
        <div className="relative">
          <img 
            src={driver.img} 
            alt={driver.name} 
            className="w-16 h-16 rounded-lg object-cover grayscale group-hover:grayscale-0 transition-all border border-slate-700 shadow-xl"
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center">
            <span className="text-[8px] font-bold text-slate-500">#</span>
          </div>
        </div>
        
        <div className="flex-1 min-w-[120px]">
          <div className="flex items-center gap-2">
            <h3 className="font-racing text-sm font-bold tracking-tight text-white leading-tight uppercase italic">{driver.name}</h3>
            {renderNameTrend()}
          </div>
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">{driver.team}</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
          <div className="flex-1 sm:flex-none">
            <label className="block text-[8px] text-slate-500 uppercase font-black mb-1 ml-1 tracking-tighter">Points to use</label>
            <div className="relative group/input">
               <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-[10px]">P</span>
               <input 
                type="number" 
                min="1"
                value={stake} 
                onChange={(e) => setStake(Math.max(1, parseInt(e.target.value) || 0))}
                className="bg-slate-950/80 border border-slate-700 rounded-lg pl-5 pr-2 py-2 w-full sm:w-24 text-xs font-bold text-white focus:outline-none focus:border-red-500 transition-colors shadow-inner"
              />
            </div>
          </div>

          <button 
            onClick={handleBetClick}
            className="bg-slate-800/80 hover:bg-red-600 border border-slate-700 hover:border-red-500 rounded-lg px-4 py-2 flex flex-col items-center justify-center transition-all group-hover:scale-105 min-w-[100px] shadow-2xl relative overflow-hidden"
          >
            <span className="text-[8px] text-slate-400 group-hover:text-white/80 font-black uppercase tracking-tighter mb-0.5">PREDICT @</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-racing font-black text-white">{driver.odds.toFixed(2)}</span>
            </div>
            
            {/* Live Movement Data */}
            <div className={`text-[8px] font-black uppercase tracking-widest mt-0.5 transition-colors ${
              isOddsShortening ? 'text-green-400' : isOddsDrifting ? 'text-red-400' : 'text-slate-500'
            }`}>
              {percentChange !== 0 ? (
                <span>
                  {percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}% 
                  <span className="text-slate-500 ml-1 opacity-60">was {driver.lastOdds.toFixed(2)}</span>
                </span>
              ) : (
                'Stable'
              )}
            </div>
          </button>
        </div>
      </div>
      
      {/* Interactive Carbon Accent */}
      <div className="mt-4 h-1 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/50 relative z-10">
        <div 
          className={`h-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(239,68,68,0.5)] ${
            isOddsShortening ? 'bg-green-500 w-3/4' : isOddsDrifting ? 'bg-red-500 w-1/4' : 'bg-red-600 w-1/2'
          }`}
          style={{ width: `${Math.min(100, Math.max(10, (1/driver.odds) * 100))}%` }}
        ></div>
      </div>
    </div>
  );
};

export default DriverCard;
