/** True when the connection string points at a Neon "pooled" (PgBouncer) endpoint, whose host contains "-pooler". */
export function isPooledUrl(url) {
  try { return new URL(String(url)).hostname.includes('-pooler'); } catch { return false; }
}
