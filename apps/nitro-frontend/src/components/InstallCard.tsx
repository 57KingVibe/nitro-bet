import React, { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

/** Everything that touches `window` runs inside an effect, so the card also renders safely on a server. */
const InstallCard: React.FC = () => {
  const [offer, setOffer] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setInstalled(!!standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    const onOffer = (e: Event) => { e.preventDefault(); setOffer(e as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setOffer(null); };
    window.addEventListener('beforeinstallprompt', onOffer);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onOffer);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!offer) return;
    await offer.prompt();
    await offer.userChoice.catch(() => null);
    setOffer(null);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2" data-testid="install-card">
      <p className="text-xs font-black uppercase text-white tracking-widest">Get the app</p>
      {installed ? (
        <p className="text-[11px] text-emerald-400">NitroBet is installed on this device.</p>
      ) : offer ? (
        <button onClick={install} className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 font-racing text-xs font-black uppercase">Install NitroBet</button>
      ) : ios ? (
        <p className="text-[11px] text-slate-400 leading-snug">On iPhone or iPad, open this page in Safari, tap the Share button, then tap <b className="text-slate-200">Add to Home Screen</b>.</p>
      ) : (
        <p className="text-[11px] text-slate-400 leading-snug">On Android, open your browser menu and tap <b className="text-slate-200">Install app</b> or <b className="text-slate-200">Add to Home screen</b>.</p>
      )}
    </div>
  );
};

export default InstallCard;
