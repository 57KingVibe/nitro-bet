export function parseCountryList(value) {
  return new Set(
    String(value ?? '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
  );
}

/**
 * Decide from Cloudflare's CF-IPCountry value. XX = unknown, T1 = Tor.
 * failClosed: when the country cannot be determined, block (use for real-money mode).
 * This is a first layer only: VPNs defeat it. Licensing and ID verification are the real controls.
 */
export function evaluateGeo({ country, blocked, failClosed }) {
  const c = String(country ?? '').trim().toUpperCase();
  if (!c || c === 'XX' || c === 'T1') {
    return failClosed ? { allowed: false, reason: 'UNKNOWN_COUNTRY' } : { allowed: true };
  }
  return blocked.has(c) ? { allowed: false, reason: 'BLOCKED_COUNTRY' } : { allowed: true };
}
