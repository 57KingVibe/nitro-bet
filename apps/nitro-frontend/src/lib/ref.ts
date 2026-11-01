// Remembers ?ref=CODE from an invite link until the person signs up.
const KEY = 'apexly_ref';
const PATTERN = /^[A-Za-z0-9]{6,12}$/;

export function captureRef(): void {
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (ref && PATTERN.test(ref)) localStorage.setItem(KEY, ref.toUpperCase());
    if (url.searchParams.has('ref')) {
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);
    }
  } catch { /* storage blocked: the invite just will not carry over */ }
}
export const getRef = (): string | undefined => { try { return localStorage.getItem(KEY) ?? undefined; } catch { return undefined; } };
export const clearRef = (): void => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
