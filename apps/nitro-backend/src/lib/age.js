/** True when dob (YYYY-MM-DD) is a real date and the person is at least minAge years old on `now`. */
export function isAtLeastAge(dob, minAge, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob ?? '');
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900) return false;
  const born = new Date(Date.UTC(y, mo - 1, d));
  // Rejects impossible dates such as 2001-02-31 (JS would silently roll them over).
  if (born.getUTCFullYear() !== y || born.getUTCMonth() !== mo - 1 || born.getUTCDate() !== d) return false;
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - minAge, now.getUTCMonth(), now.getUTCDate()));
  return born <= cutoff;
}
