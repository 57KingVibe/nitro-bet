import React from 'react';

export interface NavCategory { id: string; icon: string; label: string }

interface Props {
  categories: NavCategory[];
  selected: string;
  slipCount: number;
  slipOpen: boolean;
  signedIn: boolean;
  avatar: string;
  ghostMode: boolean;
  onSelect: (id: string) => void;
  onSlip: () => void;
  onProfile: () => void;
}

const base = 'relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 transition-colors';
const label = 'text-[9px] font-black uppercase tracking-wider truncate max-w-full px-0.5';

/** Phone navigation: series on the left, the prediction slip and the profile on the right. Hidden on large screens (the side bar is used there). */
const BottomNav: React.FC<Props> = ({ categories, selected, slipCount, slipOpen, signedIn, avatar, ghostMode, onSelect, onSlip, onProfile }) => (
  <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-[95] bg-slate-950/95 backdrop-blur border-t border-slate-800 flex items-stretch pb-[env(safe-area-inset-bottom)]">
    {categories.map((c) => {
      const active = !slipOpen && selected === c.id;
      return (
        <button key={c.id} type="button" onClick={() => onSelect(c.id)} aria-label={c.label} aria-current={active ? 'page' : undefined}
          className={`${base} ${active ? 'text-white' : 'text-slate-500'}`}>
          {active && <span className="absolute top-0 left-3 right-3 h-0.5 bg-red-600 rounded-b"></span>}
          <span className="text-xl leading-none">{c.icon}</span>
          <span className={label}>{c.id}</span>
        </button>
      );
    })}

    <button type="button" onClick={onSlip} aria-label={`Prediction slip, ${slipCount} picks`} aria-pressed={slipOpen}
      className={`${base} ${slipOpen ? 'text-white' : 'text-slate-400'}`}>
      {slipOpen && <span className="absolute top-0 left-3 right-3 h-0.5 bg-red-600 rounded-b"></span>}
      <span className="relative text-xl leading-none">
        🎟️
        {slipCount > 0 && (
          <span className="absolute -top-1.5 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center">{slipCount}</span>
        )}
      </span>
      <span className={label}>Slip</span>
    </button>

    <button type="button" onClick={onProfile} aria-label={signedIn ? 'My account' : 'Sign in'}
      className={`${base} text-slate-400`}>
      {signedIn ? (
        <span className={`w-6 h-6 rounded-full border-2 overflow-hidden ${ghostMode ? 'border-indigo-500' : 'border-slate-600'}`}><img src={avatar} alt="" className="w-full h-full" /></span>
      ) : (
        <span className="text-xl leading-none">👤</span>
      )}
      <span className={label}>{signedIn ? 'Me' : 'Join'}</span>
    </button>
  </nav>
);

export default BottomNav;
