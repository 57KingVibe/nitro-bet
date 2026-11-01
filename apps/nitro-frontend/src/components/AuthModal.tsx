import React, { useEffect, useRef, useState } from 'react';
import { api, setToken, friendlyError, PublicConfig } from '../api';
import { getRef, clearRef } from '../lib/ref';

interface Props { onClose: () => void; onAuthed: () => void; initialMode?: 'login' | 'register'; config?: PublicConfig | null }

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const gsiId = (): any => (window as any).google?.accounts?.id;

/** Loads Google's sign-in script once; resolves true when ready, false if it cannot load. */
function loadGsi(): Promise<boolean> {
  if (gsiId()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let el = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (!el) {
      el = document.createElement('script');
      el.src = GSI_SRC; el.async = true; el.defer = true;
      document.head.appendChild(el);
    }
    el.addEventListener('load', () => resolve(!!gsiId()));
    el.addEventListener('error', () => resolve(false));
  });
}

const AuthModal: React.FC<Props> = ({ onClose, onAuthed, initialMode = 'register', config }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Google: set when Google knows the person but they have no Apexly account yet (needs date of birth + 18+ first)
  const [pending, setPending] = useState<{ credential: string; email: string; name: string } | null>(null);
  const [gsiReady, setGsiReady] = useState(false);
  const googleBox = useRef<HTMLDivElement>(null);
  const onGoogleRef = useRef<(credential: string) => void>(() => {});
  const clientId = config?.googleClientId ?? null;

  const isRegister = mode === 'register';
  // the date picker will not offer anyone under 18
  const maxDob = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); })();

  const finish = (token: string) => { setToken(token); clearRef(); onAuthed(); };

  // Always points at the newest state, because Google keeps the callback it was first given.
  onGoogleRef.current = async (credential: string) => {
    setError(null); setBusy(true);
    try {
      const res = await api.google({ credential, ref: getRef() });
      if ('needsSignup' in res) setPending({ credential, email: res.email, name: res.name });
      else finish(res.token);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const finishGoogleSignup = async () => {
    if (!pending) return;
    setError(null);
    if (!dob) { setError('Please enter your date of birth.'); return; }
    if (!agree) { setError('Please confirm you are 18 or older and accept the rules.'); return; }
    setBusy(true);
    try {
      const res = await api.google({ credential: pending.credential, dateOfBirth: dob, ref: getRef() });
      if ('needsSignup' in res) setError('Please check your date of birth.');
      else finish(res.token);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  // Load Google's script and draw its button whenever the button box is on screen.
  const showBox = !pending;
  useEffect(() => {
    if (!clientId || !showBox) return;
    let off = false;
    loadGsi().then((ok) => {
      if (off || !ok) return;
      const id = gsiId();
      id.initialize({ client_id: clientId, callback: (r: { credential?: string }) => { if (r?.credential) onGoogleRef.current(r.credential); } });
      if (googleBox.current) {
        googleBox.current.innerHTML = '';
        id.renderButton(googleBox.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 320 });
      }
      setGsiReady(true);
    });
    return () => { off = true; };
  }, [clientId, showBox, mode]);

  const submit = async () => {
    setError(null);
    if (isRegister && !agree) { setError('Please confirm you are 18 or older and accept the rules.'); return; }
    setBusy(true);
    try {
      const res = isRegister
        ? await api.register({ email, password, displayName, dateOfBirth: dob, ref: getRef() })
        : await api.login({ email, password });
      finish(res.token);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white font-bold focus:outline-none focus:border-red-500';
  const label = 'text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-md max-h-full overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl animate-fade-in">
        <div className="relative h-32 overflow-hidden rounded-t-2xl bg-slate-950">
          <img src="/brand/hero.jpg" alt="Apexly" className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/80 text-slate-300 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h2 className="font-racing text-xl font-black italic uppercase text-white">{isRegister ? 'Join free' : 'Welcome back'}</h2>
            <p className="text-[11px] text-slate-500 mt-1">{isRegister ? 'Free to play. Predict race winners with points and climb the weekly leaderboard.' : 'Sign in to keep your points and predictions.'}</p>
          </div>

          {pending ? (
            <div className="space-y-4" data-testid="google-signup-step">
              <p className="text-[12px] text-slate-300 leading-snug">Welcome{pending.name ? `, ${pending.name}` : ''}. One more step to create your free account for <b className="text-white">{pending.email}</b>.</p>
              <div className="space-y-1">
                <label className={label}>Date of birth</label>
                <input className={input} type="date" value={dob} max={maxDob} onChange={(e) => setDob(e.target.value)} style={{ colorScheme: 'dark' }} data-testid="google-dob" />
              </div>
              <label className="flex items-start gap-3 text-[11px] text-slate-400 leading-snug cursor-pointer">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-red-600" data-testid="google-agree" />
                <span>I am 18 or older. I understand Apexly Lite is a free game: points have no cash value and cannot be withdrawn.</span>
              </label>
              {error && <p className="text-xs text-red-400 font-bold italic">{error}</p>}
              <button onClick={finishGoogleSignup} disabled={busy} className={`w-full py-4 rounded-xl font-racing text-sm font-black transition-all ${busy ? 'bg-slate-700 cursor-wait' : 'bg-red-600 hover:bg-red-500 glow-red'}`}>
                {busy ? 'ONE MOMENT...' : 'CREATE FREE ACCOUNT'}
              </button>
              <button className="w-full text-center text-[11px] text-slate-500 font-black uppercase" onClick={() => { setPending(null); setError(null); }}>Back</button>
            </div>
          ) : (
          <>
          {clientId && (
            <div className={gsiReady ? 'space-y-3' : 'hidden'}>
              <div ref={googleBox} className="flex justify-center min-h-[44px]" data-testid="google-button"></div>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-600 tracking-widest">
                <span className="flex-1 h-px bg-slate-800"></span>or<span className="flex-1 h-px bg-slate-800"></span>
              </div>
            </div>
          )}

          {isRegister && (
            <div className="space-y-1">
              <label className={label}>Display name</label>
              <input className={input} value={displayName} maxLength={30} onChange={(e) => setDisplayName(e.target.value)} placeholder="Shown on the leaderboard" autoComplete="nickname" />
            </div>
          )}
          <div className="space-y-1">
            <label className={label}>Email</label>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="space-y-1">
            <label className={label}>Password</label>
            <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isRegister ? 'At least 10 characters' : 'Your password'} autoComplete={isRegister ? 'new-password' : 'current-password'} />
          </div>
          {isRegister && (
            <>
              <div className="space-y-1">
                <label className={label}>Date of birth</label>
                <input className={input} type="date" value={dob} max={maxDob} onChange={(e) => setDob(e.target.value)} style={{ colorScheme: 'dark' }} />
              </div>
              <label className="flex items-start gap-3 text-[11px] text-slate-400 leading-snug cursor-pointer">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-red-600" />
                <span>I am 18 or older. I understand Apexly Lite is a free game: points have no cash value and cannot be withdrawn.</span>
              </label>
            </>
          )}

          {error && <p className="text-xs text-red-400 font-bold italic">{error}</p>}

          <button onClick={submit} disabled={busy} className={`w-full py-4 rounded-xl font-racing text-sm font-black transition-all ${busy ? 'bg-slate-700 cursor-wait' : 'bg-red-600 hover:bg-red-500 glow-red'}`}>
            {busy ? 'ONE MOMENT...' : isRegister ? 'CREATE FREE ACCOUNT' : 'SIGN IN'}
          </button>

          <p className="text-center text-[11px] text-slate-500">
            {isRegister ? 'Already have an account?' : 'New here?'}{' '}
            <button className="text-red-400 font-black uppercase" onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(null); }}>
              {isRegister ? 'Sign in' : 'Join free'}
            </button>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
