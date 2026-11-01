// Social links come from environment variables (set in Render, no code change). Bad values are ignored, never fatal.
const KEYS = { discord: 'SOCIAL_DISCORD_URL', linkedin: 'SOCIAL_LINKEDIN_URL', instagram: 'SOCIAL_INSTAGRAM_URL', x: 'SOCIAL_X_URL', medium: 'SOCIAL_MEDIUM_URL', tiktok: 'SOCIAL_TIKTOK_URL', facebook: 'SOCIAL_FACEBOOK_URL' };

export function socialLinks(env = process.env) {
  const out = {};
  for (const [name, key] of Object.entries(KEYS)) {
    try {
      const u = new URL(String(env[key] ?? '').trim());
      if (u.protocol === 'https:') out[name] = u.toString();
    } catch { /* empty or invalid: skip */ }
  }
  return out;
}
