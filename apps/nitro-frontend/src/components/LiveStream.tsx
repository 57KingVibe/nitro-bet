import React, { useState, useEffect } from 'react';

export default function LiveStream() {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Trigger sticky mode when scrolled past the main header
      setIsSticky(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Spacer to prevent layout jump when stream becomes sticky */}
      {isSticky && <div className="h-[220px] w-full" />}
      
      <div className={`transition-all duration-300 z-40 ${isSticky ? 'fixed bottom-20 right-4 w-48 shadow-2xl rounded-xl overflow-hidden border border-red-500/50' : 'relative w-full aspect-video bg-black'}`}>
        {/* Placeholder for actual video stream */}
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          <div className="text-center">
            <span className="text-red-500 animate-pulse text-4xl">●</span>
            {!isSticky && <p className="text-white font-racing font-black mt-2">LIVE TELEMETRY</p>}
          </div>
        </div>
        
        {/* Stream Overlays */}
        <div className="absolute top-2 left-2 flex gap-2">
          <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">Live</span>
          <span className="bg-black/50 backdrop-blur text-white text-[9px] font-bold px-2 py-0.5 rounded">312 km/h</span>
        </div>
        
        {isSticky && (
           <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white text-xs font-bold bg-slate-800 px-3 py-1 rounded-full">Expand</span>
           </button>
        )}
      </div>
    </>
  );
}
