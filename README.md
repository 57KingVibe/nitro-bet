# Nitro-Bet: original UI restored (Oct 3)

The frontend in `apps/nitro-frontend` is your original "NitroBet: Motorsport Adrenaline" design again:
side rail with F1 / WRC / GT / IndyCar, driver odds cards with stake input, bet slip with bet types and Ghost toggle,
race results, and the account drawer (wallet, stakes, history, settings).

- **No Gemini / AI code anywhere.** Removed: the AI Strategist tiles, Rapid Intel, Pit-Radio, The Spotter chat, `services/gemini.ts`,
  and the `@google/genai`, `openai`, `axios`, `lucide-react`, `socket.io-client` dependencies.
- The two AI tiles at the top are now **Live Telemetry / Grid Leaders**, fed by your own API (`/api/stream/unified`).
- Bet slip: the original had two buttons, and the one inside the slip cleared bets without charging the balance. It is now one button that charges the balance.
- Wallet buttons (deposit / withdraw / send) update a **local demo balance** only. Odds are simulated. A "Demo" label says so.
- The previous Gemini-rewritten frontend is kept in `legacy/frontend-gemini-rewrite/`.
- Run `npm install` once and commit the refreshed `package-lock.json` (dependencies were removed).

Buttons that are visual only until a backend exists: Verify Now (KYC), Sign Out, 2FA / Biometric toggles (they flip locally).
Copy to reword before real users see it: "E2EE", "AES-256", "Nodes: 14 | Latency: 4ms", "salt-hashed and private" describe things that do not exist yet.

---

# Nitro-Bet: fix pass (Oct 2026)

## What Render's logs showed
- API service "Nitro bet the express way" is **live** (Postgres connects, schema verified) since the manual deploy of commit 83729de.
- The earlier failed deploys of that commit died on `DATABASE_URL` / `JWT_SECRET` "Required" (env validation exits on purpose).
- Visiting the URL returns **404**: the refactor made the backend API-only, and the frontend is not hosted anywhere.
- The frontend polls `/api/stream/unified`, which the new backend did not have.
- Second service "nitro-bet" has start command `src/server.js` (no `node`) and fails on every commit.

## What changed
Backend (`apps/nitro-backend`)
- NEW `GET /api/stream/unified` (OpenF1 weather + drivers + positions, 15s cache, stale fallback, own rate limit).
- `trust proxy` on (rate limiting was counting every user as one IP behind Render).
- DB: connect timeout 2s -> 10s, `DATABASE_SSL` override, idle-error handler. CORS accepts a comma-separated list.
- `GET /` answers with JSON, unknown `/api/*` routes return JSON 404.
- Unit tests: `npm test` (5 pass).

Frontend (`apps/nitro-frontend`)
- API URL from `VITE_API_URL`; correct endpoint; polls every 10s; shows C not F; F1 not NASCAR wording.
- "Provably fair" verifier no longer shows a green "Match Validated" for any input.

Repo
- Deleted `download` / `download.pub` (an SSH private key, see below). Dead CommonJS files, the stray Express server inside the frontend, and the broken Dockerfile moved to `legacy/`.
- Root scripts: `dev:api`, `dev:web`, `build:web`, `start:api`, `test`. Dependencies untouched, so `package-lock.json` stays valid.
- `render.yaml` declares the frontend static site only.

## Do these in order
1. **Rotate the SSH key.** `download` + `download.pub` were in the public repo. Remove the public key from anywhere it is authorized (GitHub SSH/deploy keys, servers), create a new pair, and never commit it. Deleting the file does not remove it from git history; assume it is compromised.
2. If `.env` (ForgeLayer key) was ever committed, rotate that key too.
3. `git rm --cached packages/nitro.db`, commit and push this folder.
4. Render: delete the duplicate service "nitro-bet". On the API service set Health Check Path to `/health`, and set `FRONTEND_URL` to your static site URL once it exists.
5. Create the static site (New > Blueprint using `render.yaml`, or a Static Site with build `npm install && npm run build --workspace nitro-bet-frontend`, publish dir `apps/nitro-frontend/dist`).
6. Open `<api-url>/api/stream/unified`. OpenF1's live data needs a paid plan, so outside race weekends you get the latest available session.

## Not built yet
- Nothing issues JWTs (no login), no route places or settles bets, cashback trusts a client-supplied amount (flagged in code), the v1 `@nitro/logic` engine still has fake settlement.
- Marketing copy in `TierSwitcher` ("$5 referral bonus", "20% loss-cashback active") describes features that do not exist.
- The 18+ gate is a localStorage click. Real-money betting needs licensing and real age/KYC checks.
- Tailwind is loaded from the dev CDN in `index.html`; move it into the Vite build before launch.
