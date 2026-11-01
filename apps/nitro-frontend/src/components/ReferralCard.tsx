import React, { useEffect, useState } from 'react';
import { api, ReferralSummary } from '../api';

const ReferralCard: React.FC = () => {
  const [info, setInfo] = useState<ReferralSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let off = false;
    api.referral().then((r) => { if (!off) setInfo(r); }).catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, []);

  const link = info ? `${window.location.origin}/?ref=${info.code}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt('Copy your invite link:', link); }
  };
  const share = async () => {
    try { await navigator.share({ title: 'Apexly', text: 'Predict race winners for free on Apexly. Join with my link:', url: link }); }
    catch { /* cancelled */ }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3" data-testid="referral-card">
      <p className="text-xs font-black uppercase text-white tracking-widest">Invite friends</p>
      {failed && <p className="text-[11px] text-slate-500">Could not load your invite link. Try again in a moment.</p>}
      {!info && !failed && <p className="text-[11px] text-slate-500">Loading...</p>}
      {info && (
        <>
          <p className="text-[11px] text-slate-400 leading-snug">
            Get <b className="text-white">{Number(info.bonus).toLocaleString('en-US')} points</b> when a friend you invite makes their first prediction and it is settled. Up to {info.maxRewards} friends. Points only, no cash value.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[11px] text-slate-300" data-testid="invite-link">{link}</code>
            <button onClick={copy} className="px-3 py-2 rounded-lg bg-slate-800 text-[10px] font-black uppercase text-white">{copied ? 'Copied' : 'Copy'}</button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button onClick={share} className="px-3 py-2 rounded-lg bg-red-600 text-[10px] font-black uppercase text-white">Share</button>
            )}
          </div>
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
            Invited {info.invited} · Rewarded {info.rewarded} · Waiting {info.pending}
          </p>
        </>
      )}
    </div>
  );
};

export default ReferralCard;
