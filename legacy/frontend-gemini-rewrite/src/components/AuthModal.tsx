import React from 'react';

export default function AuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 w-full sm:w-96 rounded-t-3xl sm:rounded-3xl border border-slate-800 p-6 animate-slide-in relative">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 font-black text-xl active:scale-90">✕</button>
        
        <h2 className="font-racing text-2xl font-black italic text-white mb-1">ENTER THE <span className="text-red-600">GRID</span></h2>
        <p className="text-xs text-slate-400 mb-6 font-bold">Secure your session to lock in stakes.</p>

        <div className="space-y-3">
          {/* Web2 Gates */}
          <button className="w-full bg-white text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 active:bg-slate-200 transition-colors">
            <span className="text-lg">🌐</span> Continue with Google
          </button>
          
          <div className="flex items-center gap-3 py-2">
            <div className="h-px bg-slate-800 flex-1"></div>
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Or Web3 Vault</span>
            <div className="h-px bg-slate-800 flex-1"></div>
          </div>

          {/* Web3 Gates - Sovereign Setup */}
          <button className="w-full bg-[#0052FF]/10 border border-[#0052FF]/30 text-[#0052FF] font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 active:bg-[#0052FF]/20 transition-colors">
            <span className="text-lg">🔵</span> Connect Base Wallet
          </button>
          <button className="w-full bg-[#14F195]/10 border border-[#14F195]/30 text-[#14F195] font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 active:bg-[#14F195]/20 transition-colors">
            <span className="text-lg">🟣</span> Connect Solana Phantom
          </button>
        </div>
      </div>
    </div>
  );
}
