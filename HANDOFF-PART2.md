# Apexly handoff, part 2 (for a fresh chat)

**Neon move (Oct 24): guide, script and guards are written; the move itself has NOT been done yet (needs the operator's Neon account). Deadline 2026-10-31.**

**Status Oct 24: steps 1 to 5 below are DONE** (website wired, browser test extended to 54 checks, README updated). What is left is the roadmap at the bottom and the Render setup in docs/OPERATIONS.md.

Paste to the new chat: "Read HANDOFF-PART2.md and NITROBET-HANDOFF.md in the attached zip. Finish the remaining steps in order. Keep replies short. One zip at the end."

## Product in one paragraph
Apexly ("The Net Race") is a free motorsport prediction game. Players get 1,000 play points, predict race winners in a points pool (price = pool share, shown as candlestick charts), and climb a weekly leaderboard. Real-money "Full" tier (wallet + Stable chain contract) is designed and the contract exists in another chat; it needs a licence, ID checks and an audit before real money. Operator: Muhammad (Nigeria), works from a phone (Termux), deploys by zip + git push to Render.

## Done and tested (backend, 35 unit tests pass)
- Accounts, ledger in cents, points-pool markets, settlement, leaderboard, Ghost Mode, OpenF1 telemetry, candle chart API.
- NEW this round (migration `004_community.sql`): referral program (points only, paid when the referred player's first prediction settles, capped), Google sign-in (`POST /api/auth/google`, token verified with no extra library, new accounts must confirm 18+ first), wallet linking by signature (`/api/me/wallet*`, own keccak/secp256k1 code tested against known vectors and Node's OpenSSL), operator endpoints (`/api/admin/stats`, `/winners`, `/markets`), social links and Google client id in `GET /api/config`.
- `apps/nitro-backend/scripts/ops.sh` (stats, markets, create, close, settle, void, winners) and `docs/OPERATIONS.md` (step-by-step guide). ops.sh syntax-checked only: jq formatting not run (no jq in the build sandbox).

## Written but NOT wired into the website yet
`src/components/ReferralCard.tsx`, `WalletCard.tsx`, `SocialLinks.tsx`, `src/lib/ref.ts` (captureRef is already called in index.tsx), and the new calls in `src/api.ts` (config, google, referral, wallet*, register with `ref`).

## Remaining steps, in order
1. **App.tsx**: fetch `api.config()` once into state; render `<SocialLinks links={config?.social}/>` under `<InstallCard/>` in the right aside; pass `config` to AuthModal and AccountModal.
2. **AccountModal.tsx**: in the Points tab, below "How Lite works", render `<ReferralCard/>` and `<WalletCard/>`.
3. **AuthModal.tsx**: if `config.googleClientId` is set, load `https://accounts.google.com/gsi/client` (skip if `window.google.accounts.id` already exists), `initialize` with a callback, `renderButton` into a div above the form with an "or" divider. Callback calls `api.google({credential, ref: getRef()})`. If the answer has `needsSignup`, show a step asking date of birth + the 18+ checkbox, then call again with `dateOfBirth`. On success `setToken`, `clearRef()`, `onAuthed()`. Pass `ref: getRef()` in `api.register` too, and `clearRef()` after sign-up.
4. **Browser test**: build for the test with esbuild, then extend `tools/e2e` mock and checks: invite code and link visible; `?ref=CODE` is sent on sign-up; Google flow with a fake `window.google` object (needsSignup step); wallet link with a fake `window.ethereum` signing through the real `lib/eth.js` `signPersonal`; social links show only the configured ones.
   Build command: `esbuild src/index.tsx --bundle --jsx=automatic --platform=browser --outfile=/tmp/e2e/site/app.js --alias:react=<global react> --alias:react-dom=<global react-dom> --define:import.meta.env='{"VITE_API_URL":"http://127.0.0.1:4777","PROD":false}'` and a copy of index.html without the tailwind and fonts tags.
5. Update README, zip, deliver one file.

## Known facts to keep
- Admin writes use header `X-Admin-Key`. Never ask the user to paste secrets.
- The live Render free Postgres expires 2026-10-31. Plan: move to Neon free (set `DATABASE_URL`); tables are recreated by migrations at boot.
- A market must be open for the chart to show: `bash apps/nitro-backend/scripts/ops.sh create`.
- Google sign-in needs `GOOGLE_CLIENT_ID` in Render (steps in docs/OPERATIONS.md). Social links come from `SOCIAL_*_URL` env vars.
- Name "Apexly" is not yet checked for trademark or domains. Logo is still the old "N".
- Prizes are manual and off by default; legal check needed before any payout.
- Real-money mode is blocked in code until KYC and payments exist.

## After this (roadmap)
Email verification + forgot password (needs an email service), Live Show panel (own stream only, never restreamed broadcasts), custom domain, trademark check, Full-tier contract on Stable testnet (other chat), licence, audit.
