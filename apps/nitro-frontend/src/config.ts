// Set VITE_API_URL at build time (see .env.example). The fallback is the current Render API.
const fromEnv = import.meta.env.VITE_API_URL as string | undefined;

export const API_BASE_URL: string =
  (fromEnv ? fromEnv.replace(/\/+$/, '') : '') || 'https://nitro-bet-the-express-way.onrender.com';
