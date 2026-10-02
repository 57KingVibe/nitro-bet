// Set VITE_API_URL at build time (see .env.example). The fallback is the current Render backend.
export const API_BASE_URL: string =
  ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://nitro-bet-the-express-way.onrender.com';
