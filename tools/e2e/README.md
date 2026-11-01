Browser test for the website (Playwright + a stand-in API that uses the real pool maths and the real wallet-signature code).
Run it from the repo root:
    bash tools/e2e/build.sh     # builds the site into /tmp/e2e/site with esbuild (no Tailwind or fonts, works offline)
    node tools/e2e/run.mjs      # starts the stand-in API on :4777 and the site on :4778, runs 54 checks
Paths are relative to the repo now. Two things are assumed from this sandbox; change them if your machine differs:
- Global npm folder `/home/claude/.npm-global/lib/node_modules` (react, react-dom, playwright, and esbuild inside `tsx`). Override with `G=... bash tools/e2e/build.sh`; run.mjs has the same path on its `createRequire` line.
- Playwright's Chromium is found through `PLAYWRIGHT_BROWSERS_PATH`.
mock-api.mjs mirrors /api/config, /api/auth/google (credentials look like `fake:<email>:<name>`), /api/me/referral and /api/me/wallet*.
