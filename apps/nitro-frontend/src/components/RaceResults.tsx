
import React from 'react';
import { RaceResult } from '../types';

interface RaceResultsProps {
  results: RaceResult[];
}

const RaceResults: React.FC<RaceResultsProps> = ({ results }) => {
  return (
    <div className="space-y-4">
      {results.map((result) => (
        <div key={result.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 transition-all hover:bg-slate-800/40">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700">{result.category}</span>
                <span className="text-[10px] text-slate-500 font-bold">{result.date}</span>
              </div>
              <h4 className="text-sm font-racing font-bold text-white uppercase italic">{result.title}</h4>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase font-black">Winner</p>
              <p className="text-xs font-bold text-red-500">{result.winner}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 border-t border-slate-800/50 pt-3">
            {result.podium.map((name, idx) => (
              <div key={idx} className="text-center group">
                <div className={`w-1.5 h-1.5 rounded-full mx-auto mb-1 ${
                  idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-400' : 'bg-orange-600'
                }`}></div>
                <p className="text-[8px] text-slate-500 uppercase font-bold truncate px-1 group-hover:text-slate-300 transition-colors">{name}</p>
                <p className="text-[7px] text-slate-600 font-black tracking-widest">{idx + 1}ST</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RaceResults;
