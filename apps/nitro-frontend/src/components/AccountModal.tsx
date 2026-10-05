import React, { useState } from 'react';
import { Profile, WagerRow, LedgerEntry, fmtPts } from '../api';
import InstallCard from './InstallCard';

interface Props {
  profile: Profile;
  wagers: WagerRow[] | null;
  ledger: LedgerEntry[] | null;
  onClose: () => void;
  onSignOut: () => void;
  onToggleGhost: (next: boolean) => void;
}

type Tab = 'points' | 'predictions' | 'history' | 'settings';

const STATUS: Record<WagerRow['status'], { text: string; cls: string }> = {
  open: { text: 'Open', cls: 'text-yellow-400' },
  won: { text: 'Won', cls: 'text-green-400' },
  lost: { text: 'Lost', cls: 'text-red-500' },
  void: { text: 'Refunded', cls: 'text-blue-400' },
};

const KIND: Record<string, { text: string; icon: string }> = {
  signup_credit: { text: 'Welcome points', icon: '🎁' },
  bet_stake: { text: 'Prediction placed', icon: '🎯' },
  bet_payout: { text: 'Prediction won', icon: '🏆' },
  bet_refund: { text: 'Prediction refunded', icon: '↩️' },
  adjustment: { text: 'Adjustment', icon: '🛠️' },
};

const AccountModal: React.FC<Props> = ({ profile, wagers, ledger, onClose, onSignOut, onToggleGhost }) => {
  const [tab, setTab] = useState<Tab>('points');
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.displayName)}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-md h-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative">
              <img src={avatar} className="w-12 h-12 rounded-full border-2 border-red-600 p-0.5 bg-slate-800" alt="Avatar" />
              {profile.ghostMode && (
                <div className="absolute -top-1 -right-1 bg-indigo-600 border border-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-lg animate-pulse">👻</div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-racing text-sm font-black text-white italic uppercase truncate">{profile.displayName}</h3>
              <p className="text-[10px] text-slate-500 font-bold tracking-widest truncate">{profile.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors" aria-label="Close">✕</button>
        </div>

        {/* Balance */}
        <div className="p-8 bg-gradient-to-br from-red-600 to-red-900 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 carbon-bg"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-1 relative z-10">Nitro Points</p>
          <h2 className="text-4xl font-racing font-black text-white italic relative z-10">{fmtPts(profile.balance)}</h2>
          <span className="relative z-10 inline-block mt-2 px-2 py-0.5 rounded-full bg-black/30 border border-white/20 text-[8px] font-black uppercase tracking-widest text-white/80">Free to play - no cash value</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 overflow-x-auto">
          {(['points', 'predictions', 'history', 'settings'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 min-w-[80px] py-4 text-[10px] font-black uppercase tracking-widest transition-all ${tab === t ? 'text-red-500 bg-slate-800/50 border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === 'points' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <p className="text-xs font-black uppercase text-white tracking-widest">How Lite works</p>
                <ul className="text-[11px] text-slate-400 space-y-1.5 leading-snug list-disc pl-4">
                  <li>You start with free points. Use them to predict race winners.</li>
                  <li>A correct pick returns your points multiplied by the odds.</li>
                  <li>Your net points decide your place on the weekly leaderboard.</li>
                  <li>Points are for fun: no deposits, no withdrawals, no cash value.</li>
                </ul>
              </div>
              <div className="bg-slate-950 border border-dashed border-indigo-500/40 rounded-xl p-4 text-center">
                <p className="text-xs font-black uppercase text-indigo-300 tracking-widest">NitroBet Full - coming soon</p>
                <p className="text-[10px] text-slate-500 mt-1">Connect a wallet and predict on-chain once the Full tier launches.</p>
              </div>
            </div>
          )}

          {tab === 'predictions' && (
            <div className="space-y-4 animate-fade-in">
              {wagers === null ? <p className="text-xs text-slate-500 italic text-center py-6">Loading...</p>
                : wagers.length === 0 ? <p className="text-xs text-slate-500 italic text-center py-6">No predictions yet. Pick a driver to get started.</p>
                : wagers.map((w) => (
                  <div key={w.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-racing text-xs font-bold text-white uppercase italic">{w.outcomeLabel}</h4>
                        <p className="text-[9px] text-slate-500 uppercase font-black">{w.marketTitle}</p>
                      </div>
                      <span className={`text-[10px] font-black uppercase ${STATUS[w.status].cls}`}>{STATUS[w.status].text}</span>
                    </div>
                    <div className="flex justify-between items-end border-t border-slate-900 pt-3 mt-1">
                      <div>
                        <p className="text-[8px] text-slate-600 uppercase font-black">Points / Odds</p>
                        <p className="text-xs font-bold text-slate-300">{fmtPts(w.stake)} @ {w.odds}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-slate-600 uppercase font-black">{w.status === 'won' ? 'Returned' : w.status === 'lost' ? 'Lost' : w.status === 'void' ? 'Refunded' : 'Potential'}</p>
                        <p className={`text-sm font-racing font-black ${w.status === 'won' ? 'text-green-500' : w.status === 'lost' ? 'text-slate-500' : 'text-yellow-400'}`}>
                          {w.status === 'lost' ? '0.00' : fmtPts(w.status === 'void' ? w.stake : w.potentialPayout)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3 animate-fade-in">
              {ledger === null ? <p className="text-xs text-slate-500 italic text-center py-6">Loading...</p>
                : ledger.length === 0 ? <p className="text-xs text-slate-500 italic text-center py-6">Nothing here yet.</p>
                : ledger.map((e) => {
                  const k = KIND[e.kind] ?? { text: e.kind, icon: '🔁' };
                  return (
                    <div key={e.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs">{k.icon}</div>
                        <div>
                          <p className="text-xs font-bold text-white">{k.text}</p>
                          <p className="text-[8px] text-slate-500 uppercase">{new Date(e.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <p className={`text-xs font-racing font-bold ${e.amountMinor >= 0 ? 'text-green-400' : 'text-red-400'}`}>{e.amountMinor >= 0 ? '+' : ''}{fmtPts(e.amount)}</p>
                    </div>
                  );
                })}
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-8 animate-fade-in">
              <section className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-red-500 tracking-[0.2em]">Privacy</h4>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">Ghost Mode</p>
                      <p className="text-[9px] text-slate-500 uppercase">Hide your name on the public leaderboard</p>
                    </div>
                    <button onClick={() => onToggleGhost(!profile.ghostMode)} aria-pressed={profile.ghostMode}
                      className={`w-10 h-5 rounded-full relative transition-colors ${profile.ghostMode ? 'bg-red-600' : 'bg-slate-800'}`}>
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${profile.ghostMode ? 'left-6' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-snug">With Ghost Mode on, other players see an anonymous tag like "Ghost-4F2A" instead of your display name.</p>
                </div>
              </section>

              <InstallCard />

              <button onClick={onSignOut} className="w-full py-4 border border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-red-500 hover:border-red-500/50 transition-all">Sign Out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountModal;
