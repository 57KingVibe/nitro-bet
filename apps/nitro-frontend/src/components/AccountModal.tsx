
import React, { useState } from 'react';
import { User, TransactionType, StakeStatus, UserSettings } from '../types';

interface AccountModalProps {
  user: User;
  onClose: () => void;
  onAction: (type: TransactionType, amount: number, currency?: 'USD' | 'NGN') => void;
  onUpdateSettings?: (settings: Partial<UserSettings>) => void;
}

const AccountModal: React.FC<AccountModalProps> = ({ user, onClose, onAction, onUpdateSettings }) => {
  const [activeTab, setActiveTab] = useState<'wallet' | 'stakes' | 'history' | 'settings'>('wallet');
  const [amount, setAmount] = useState<string>('');
  const [region, setRegion] = useState<'Global' | 'Africa'>('Global');
  const [error, setError] = useState<string | null>(null);

  const NGN_TO_USD = 1 / 1500;

  const handleAction = (type: TransactionType) => {
    setError(null);
    const val = parseFloat(amount);
    
    if (isNaN(val) || val <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (type === 'deposit') {
      if (region === 'Global' && val < 0.5) {
        setError("Minimum global deposit is $0.50");
        return;
      }
      if (region === 'Africa' && val < 200) {
        setError("Minimum African deposit is ₦200");
        return;
      }
    }

    const finalAmount = region === 'Africa' && type === 'deposit' ? val * NGN_TO_USD : val;
    onAction(type, finalAmount, region === 'Africa' ? 'NGN' : 'USD');
    setAmount('');
  };

  const getStatusColor = (status: StakeStatus) => {
    switch (status) {
      case 'active': return 'text-yellow-400';
      case 'won': return 'text-green-400';
      case 'lost': return 'text-red-500';
      case 'cashed_out': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-md h-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={user.avatar} className="w-12 h-12 rounded-full border-2 border-red-600 p-0.5 bg-slate-800" alt="Avatar" />
              {user.settings.ghostMode && (
                <div className="absolute -top-1 -right-1 bg-indigo-600 border border-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-lg animate-pulse">
                  👻
                </div>
              )}
            </div>
            <div>
              <h3 className="font-racing text-sm font-black text-white italic uppercase">
                {user.settings.ghostMode ? 'Ghost Participant' : user.name}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">
                {user.settings.ghostMode ? '••••••••••' : user.username}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">✕</button>
        </div>

        {/* Balance Display */}
        <div className="p-8 bg-gradient-to-br from-red-600 to-red-900 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 carbon-bg"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-1 relative z-10">Nitro Balance</p>
          <h2 className="text-4xl font-racing font-black text-white italic relative z-10">${user.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
          <span className="relative z-10 inline-block mt-2 px-2 py-0.5 rounded-full bg-black/30 border border-white/20 text-[8px] font-black uppercase tracking-widest text-white/80">Demo wallet - no real money</span>
          <div className="absolute bottom-2 right-4 flex items-center gap-1 opacity-50">
             <span className="text-[8px] font-black text-white/80 uppercase">Secured</span>
             <span className="text-[10px]">🔒</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 overflow-x-auto">
          {(['wallet', 'stakes', 'history', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[80px] py-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? 'text-red-500 bg-slate-800/50 border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'wallet' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex">
                <button onClick={() => setRegion('Global')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${region === 'Global' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500'}`}>Global ($)</button>
                <button onClick={() => setRegion('Africa')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${region === 'Africa' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500'}`}>Africa (₦)</button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block ml-1">Deposit Amount</label>
                  <span className="text-[8px] text-slate-600 font-bold uppercase">Min: {region === 'Global' ? '$0.50' : '₦200'}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">{region === 'Global' ? '$' : '₦'}</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={`w-full bg-slate-950 border ${error ? 'border-red-500/50' : 'border-slate-800'} rounded-xl py-4 pl-10 pr-4 text-white font-racing font-bold focus:outline-none focus:border-red-500`} />
                </div>
                {error && <p className="text-[10px] text-red-500 font-bold italic ml-1">{error}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleAction('deposit')} className="col-span-2 bg-red-600 hover:bg-red-500 p-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"><span className="text-xl">💳</span><span className="text-[10px] font-black uppercase text-white">Deposit Fiat</span></button>
                <button onClick={() => handleAction('withdrawal')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-xl flex flex-col items-center gap-2 transition-all"><span className="text-xl">🏦</span><span className="text-[10px] font-black uppercase text-slate-400">Withdraw</span></button>
                <button onClick={() => handleAction('send')} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-xl flex flex-col items-center gap-2 transition-all"><span className="text-xl">📤</span><span className="text-[10px] font-black uppercase text-slate-400">Send</span></button>
              </div>
              <p className="text-[8px] text-slate-600 text-center uppercase tracking-widest flex items-center justify-center gap-2">
                 <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                 End-to-End Encrypted Transfer Network
              </p>
            </div>
          )}

          {activeTab === 'stakes' && (
            <div className="space-y-4 animate-fade-in">
              {user.stakes.map(stake => (
                <div key={stake.id} className={`bg-slate-950 border ${stake.isAnonymous ? 'border-indigo-500/30' : 'border-slate-800'} rounded-xl p-4 group relative`}>
                  {stake.isAnonymous && (
                    <div className="absolute top-0 right-4 -mt-2 bg-indigo-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase italic">Encrypted Stake</div>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-racing text-xs font-bold text-white uppercase italic">{stake.driverName}</h4>
                      <p className="text-[9px] text-slate-500 uppercase font-black">{stake.betType}</p>
                    </div>
                    <span className={`text-[10px] font-black uppercase ${getStatusColor(stake.status)}`}>{stake.status.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-slate-900 pt-3 mt-1">
                    <div>
                      <p className="text-[8px] text-slate-600 uppercase font-black">Stake / Odds</p>
                      <p className="text-xs font-bold text-slate-300">${stake.stake} @ {stake.odds.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-slate-600 uppercase font-black">{stake.status === 'won' ? 'Payout' : 'Potential'}</p>
                      <p className={`text-sm font-racing font-black ${stake.status === 'won' ? 'text-green-500' : 'text-red-500'}`}>
                        ${(stake.resultAmount || stake.toWin).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8 animate-fade-in">
              {/* Privacy: Ghost Mode */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-red-500 tracking-[0.2em]">Privacy & Anonymity</h4>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">Ghost Mode</p>
                      <p className="text-[9px] text-slate-500 uppercase">Hide identity on global leaderboard</p>
                    </div>
                    <button 
                      onClick={() => onUpdateSettings?.({ ghostMode: !user.settings.ghostMode })}
                      className={`w-10 h-5 rounded-full relative transition-colors ${user.settings.ghostMode ? 'bg-red-600' : 'bg-slate-800'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${user.settings.ghostMode ? 'left-6' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-indigo-900/10 border border-indigo-500/20 rounded-lg">
                    <span className="text-lg">🛡️</span>
                    <p className="text-[9px] text-indigo-400 font-medium leading-tight uppercase italic">
                      End-to-End Encryption enabled. All your betting patterns are salt-hashed and private.
                    </p>
                  </div>
                </div>
              </section>

              {/* Account Verification (KYC) */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Compliance & Safety</h4>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl">🆔</div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase">KYC Identification</p>
                      <p className={`text-[9px] font-black uppercase ${user.settings.kycStatus === 'verified' ? 'text-green-500' : 'text-yellow-500'}`}>
                        {user.settings.kycStatus === 'verified' ? 'Fully Verified' : 'Action Required'}
                      </p>
                    </div>
                  </div>
                  {user.settings.kycStatus !== 'verified' && (
                    <button className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase text-white transition-colors">Verify Now</button>
                  )}
                </div>
              </section>

              {/* Advanced Security */}
              <section className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Security Grid</h4>
                <div className="space-y-2">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                     <p className="text-xs font-bold text-white uppercase">2-Factor Authentication</p>
                     <button onClick={() => onUpdateSettings?.({ twoFactorAuth: !user.settings.twoFactorAuth })} className={`w-10 h-5 rounded-full relative transition-colors ${user.settings.twoFactorAuth ? 'bg-green-600' : 'bg-slate-800'}`}>
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${user.settings.twoFactorAuth ? 'left-6' : 'left-1'}`}></div>
                     </button>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                     <p className="text-xs font-bold text-white uppercase">Biometric Lock</p>
                     <button onClick={() => onUpdateSettings?.({ biometricLock: !user.settings.biometricLock })} className={`w-10 h-5 rounded-full relative transition-colors ${user.settings.biometricLock ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${user.settings.biometricLock ? 'left-6' : 'left-1'}`}></div>
                     </button>
                  </div>
                </div>
              </section>

              <button className="w-full py-4 border border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:text-red-500 hover:border-red-500/50 transition-all">Sign Out Current Session</button>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3 animate-fade-in">
              {user.history.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/30 transition-colors border-b border-slate-800 last:border-0 relative">
                  {item.isEncrypted && <div className="absolute top-1 right-1 text-[8px] opacity-20">🔒 E2EE</div>}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs">{item.type === 'deposit' ? '💰' : item.type === 'withdrawal' ? '💸' : '🔁'}</div>
                    <div>
                      <p className="text-xs font-bold text-white">{item.description}</p>
                      <p className="text-[8px] text-slate-500 uppercase">{new Date(item.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className={`text-xs font-racing font-bold ${item.type === 'deposit' || item.type === 'receive' ? 'text-green-400' : 'text-red-400'}`}>
                    {item.type === 'deposit' || item.type === 'receive' ? '+' : '-'}${item.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountModal;
