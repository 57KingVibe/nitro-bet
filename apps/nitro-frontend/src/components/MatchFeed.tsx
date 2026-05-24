import React, { useEffect, useState } from 'react';
import axios from 'axios';

const MatchFeed = () => {
  const [feedData, setFeedData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        // Hitting your local Tactical Engine on port 5000
        const res = await axios.get('http://localhost:5000/api/stream/unified');
        setFeedData(res.data);
        setError(false);
      } catch (err) {
        console.error("Telemetry link severed:", err);
        setError(true);
      }
    };
    
    // Initial fetch
    fetchTelemetry();
    
    // High-frequency polling (every 5 seconds) to catch grid shifts instantly
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl text-center">
        <p className="text-red-400 font-mono text-sm animate-pulse">⚠️ Tactical Engine Offline. Awaiting Telemetry...</p>
      </div>
    );
  }

  if (!feedData) {
    return (
      <div className="p-4 flex items-center justify-center">
         <p className="text-blue-500 font-mono text-sm animate-pulse">Establishing secure link to NASCAR grid...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/80 p-6 rounded-2xl border border-blue-500/20 backdrop-blur-xl text-slate-200 w-full max-w-md mx-auto mt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-widest text-white flex items-center gap-3">
          <span className="w-3 h-3 bg-red-600 rounded-full animate-ping"></span>
          LIVE TELEMETRY
        </h2>
        <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-blue-400 font-mono">
          SYNCED
        </span>
      </div>
      
      <div className="flex flex-col gap-4">
        {/* Track Conditions Module */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Track Temp</h3>
          <p className="text-2xl font-light text-blue-300">
            {feedData.trackConditions?.temp ? `${feedData.trackConditions.temp}°F` : 'OPTIMAL'}
          </p>
        </div>
        
        {/* Live Leaderboard Module */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
           <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Grid Leaders</h3>
           <div className="flex flex-col gap-2">
             {feedData.leaderboard && feedData.leaderboard.length > 0 ? (
               feedData.leaderboard.map((driver: any, i: number) => (
                 <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-slate-800/50 last:border-0">
                   <span className="font-medium text-slate-300"><span className="text-blue-500 mr-2">{i + 1}.</span> {driver.name}</span>
                 </div>
               ))
             ) : (
               <p className="text-slate-500 text-xs italic">Awaiting grid placement data...</p>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default MatchFeed;
