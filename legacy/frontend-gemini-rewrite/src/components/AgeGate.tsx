import { useState, useEffect } from 'react';

export default function AgeGate({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState(true); // Default true to prevent hydration flash

  useEffect(() => {
    const verified = localStorage.getItem('nitro_age_verified');
    if (!verified) {
      setIsVerified(false);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('nitro_age_verified', 'true');
    setIsVerified(true);
  };

  if (isVerified) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm px-4">
      <div className="bg-slate-900 border border-red-500/50 p-6 rounded-xl max-w-md text-center glow-red">
        <h2 className="text-2xl font-racing text-red-500 mb-4">RESTRICTED ACCESS</h2>
        <p className="text-slate-300 mb-6 text-sm leading-relaxed">
          Nitro-Bet contains adult prediction markets. You must be at least 18 years old to enter. 
          By clicking accept, you confirm your age and agree to our Terms of Service.
        </p>
        <button 
          onClick={handleAccept}
          className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors"
        >
          I AM 18 OR OLDER
        </button>
      </div>
    </div>
  );
}
