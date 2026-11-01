import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api';

const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

/** Links an Ethereum-compatible wallet by signing a message. Free, moves no funds, works in wallet browsers. */
const WalletCard: React.FC = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eth = (typeof window !== 'undefined' ? (window as any).ethereum : undefined) as { request: (a: { method: string; params?: unknown[] }) => Promise<any> } | undefined;

  useEffect(() => {
    let off = false;
    api.wallet().then((w) => { if (!off) { setAddress(w.address); setLoaded(true); } }).catch(() => { if (!off) setLoaded(true); });
    return () => { off = true; };
  }, []);

  const connect = async () => {
    if (!eth) return;
    setError(null); setBusy(true);
    try {
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      const chosen = accounts[0];
      if (!chosen) throw new Error('no account');
      const { message } = await api.walletChallenge(chosen);
      const signature: string = await eth.request({ method: 'personal_sign', params: [message, chosen] });
      const res = await api.walletLink(chosen, signature);
      setAddress(res.address);
    } catch (e: any) {
      setError(e?.code === 4001 ? 'Cancelled in your wallet.' : e?.name === 'ApiError' ? friendlyError(e) : 'Could not link the wallet. Please try again.');
    } finally { setBusy(false); }
  };

  const host = typeof window !== 'undefined' ? window.location.host : '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3" data-testid="wallet-card">
      <p className="text-xs font-black uppercase text-white tracking-widest">Wallet</p>
      {address ? (
        <p className="text-[11px] text-emerald-400 break-all" data-testid="wallet-address">Linked: {short(address)}</p>
      ) : (
        <p className="text-[11px] text-slate-400 leading-snug">
          Link an Ethereum-compatible wallet (MetaMask, Trust Wallet and others). If you win a prize, this is where it would be sent. Linking is free, only asks you to sign a message, and never moves funds.
        </p>
      )}
      {loaded && eth && (
        <button onClick={connect} disabled={busy} className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-[11px] font-black uppercase text-white">
          {busy ? 'Check your wallet...' : address ? 'Link a different wallet' : 'Connect wallet'}
        </button>
      )}
      {loaded && !eth && !address && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500 leading-snug">No wallet found in this browser. Open Apexly inside your wallet app's browser:</p>
          <div className="flex gap-2">
            <a href={`https://metamask.app.link/dapp/${host}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2.5 rounded-lg bg-slate-800 text-[10px] font-black uppercase text-white">MetaMask</a>
            <a href={`https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(origin)}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2.5 rounded-lg bg-slate-800 text-[10px] font-black uppercase text-white">Trust Wallet</a>
          </div>
        </div>
      )}
      {error && <p className="text-[11px] text-red-400 font-bold">{error}</p>}
    </div>
  );
};

export default WalletCard;
