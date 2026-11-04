# Running Apexly by hand (operator guide)

You run everything from Termux with one tool: `apps/nitro-backend/scripts/ops.sh`. No code, no dashboards.
Winners' emails are private. Never post that output anywhere.

## One-time setup (2 minutes)
1. `pkg install -y curl jq`
2. `cd ~/work/repo`
3. Run any command below. The first time it asks for your **admin key** (the `ADMIN_API_KEY` you set in Render). Typing is hidden, so paste and press Enter. Do one thing at a time.
4. The first request can take up to 50 seconds if the server was asleep.

## How many people signed up
`bash apps/nitro-backend/scripts/ops.sh stats`
- **total** = everyone who ever signed up (including your own test accounts).
- **new in 24h / 7 days** = growth.
- **predicted at least once** = people who actually played. This is the number that matters.
- **active last 7 days** = people still coming back.
- **referred players / rewarded** = how the invite links are working.
- **Google / wallet linked / ghost mode** = how people sign up and how many linked a wallet (needed for prizes).
- Sign-ups per day and the top countries are listed underneath.

## The race-week routine
| When | Command | What it does |
|---|---|---|
| Start of race week | `bash apps/nitro-backend/scripts/ops.sh create` | Opens the market. Add a title: `ops.sh create "Monaco GP: Winner"`. It then **closes at lights out and settles itself** about 2 hours after the race (from the official OpenF1 result). The steps below are only needed by hand |
| Before the race starts | `bash apps/nitro-backend/scripts/ops.sh close` | Stops new predictions (so nobody predicts after seeing the result) |
| After the official result | `bash apps/nitro-backend/scripts/ops.sh settle "Max Verstappen"` | Pays the winners and updates the leaderboard. Type the winner exactly as listed. It asks you to type yes. |
| Race cancelled | `bash apps/nitro-backend/scripts/ops.sh void` | Refunds everyone |
| Any time | `bash apps/nitro-backend/scripts/ops.sh markets` | Lists markets, status and ids |

Always take the winner from the official classification, not from social media. Settling cannot be undone.

**Automatic settlement.** Markets made with `ops.sh create` carry an "auto-settles" tag (see `ops.sh markets`). The server checks every 5 minutes: it closes predictions when the race starts, and 2 hours after the race ends it settles with the driver OpenF1 lists in P1. If something is unclear (no result yet, the winner is not one of the outcomes) it does nothing and writes one line to the Render log starting with `[AUTO]`, and you settle or void by hand. Older markets and markets without the tag always stay manual. If two markets are open, add the id from `ops.sh markets`: `ops.sh void <id>`, `ops.sh settle "Name" <id>`, `ops.sh close <id>`.

## Weekly winners and prizes (manual)
1. After you settle the last race of the week: `bash apps/nitro-backend/scripts/ops.sh winners week 0`
   (use `winners week 1` on a later day to see the week that just ended, `winners all` for all time).
2. You get rank, name, net points, email and wallet (if linked).
3. Contact the winners by email. Ask them to open **Account > Points > Wallet** and link a wallet if they have not.
4. Before you pay anyone: check each winner is a real, separate person (one account per person), and write down who you paid, how much, the date and the transaction link. Keep this record.
5. Pay only from **your own** money. Never use player points or deposits (there are none in Lite).
6. Check the rules for prize competitions in your country and the winners' countries before the first payout. Prizes of real value can turn a free game into a regulated one. Ask a lawyer once, early.
Prizes are not automatic. `WEEKLY_PRIZE_ENABLED` only changes what the site says.

## Move the database to Neon (do this before 31 October 2026)
Render's free database is deleted on **2026-10-31**. Neon's free one has no end date. Do these in order, one at a time. Until step 4 nothing changes for players.
1. **Make the Neon database.** Go to neon.com, sign up (free), create a project. Pick the region closest to your Render API service. Name the database anything (for example `apexly`).
2. **Copy the DIRECT address.** In Neon press **Connect**, switch **Connection pooling OFF**, and copy the address. Its host must NOT contain `-pooler`. (The pooled address can break the start-up migrations. The server now warns in its logs if you use it by mistake.)
3. **Keep your players (optional).** Check `bash apps/nitro-backend/scripts/ops.sh stats` first. If it is only test accounts, skip this step: Neon starts empty and the tables are created at boot. To keep everyone:
   - `pkg install postgresql`
   - In Render open your database and copy the **External Database URL**.
   - `bash apps/nitro-backend/scripts/move-db.sh` and paste the old address, then the Neon one (typing is hidden). It copies everything in one all-or-nothing step and prints row counts for both sides. Only go on if it says **MATCH**.
4. **Point the API at Neon.** Render > API service > Environment > change `DATABASE_URL` to the Neon address. Leave `DATABASE_SSL` unset. Keep `JWT_SECRET` the same so people stay signed in. Save and deploy.
5. **Check.** Open `<api-url>/health`, then run `ops.sh stats`. With step 3 the player counts match. Without it, the logs show `migration applied` lines and you create a market with `ops.sh create`.
6. **Keep the Render database until 31 October as a backup**, then let it expire. Delete the dump file if you made one by hand (`move-db.sh` deletes its own).
The first request after Neon has been idle takes about a second longer (it sleeps when unused). That is normal.

## Settings you control in Render (API service > Environment)
| Name | What it does |
|---|---|
| `ADMIN_API_KEY` | Your operator key (24+ characters, keep it secret) |
| `GOOGLE_CLIENT_ID` | Turns on "Continue with Google" (see below) |
| `SOCIAL_DISCORD_URL`, `SOCIAL_X_URL`, `SOCIAL_INSTAGRAM_URL`, `SOCIAL_TIKTOK_URL`, `SOCIAL_FACEBOOK_URL`, `SOCIAL_LINKEDIN_URL`, `SOCIAL_MEDIUM_URL` | Your page links. Each must start with `https://`. Only filled ones show on the site |
| `REFERRAL_BONUS_MINOR` | Referrer bonus in cents of a point. 5000 = 50 points |
| `REFERRAL_MAX_REWARDS` | Rewarded referrals per person (default 20) |
| `PUBLIC_SITE_URL` | Your site address, shown in the wallet signing message |
| `AUTO_SETTLE_ENABLED` | `true` (default) or `false` to settle everything by hand |
| `AUTO_SETTLE_DELAY_MIN` | Minutes to wait after the race ends before settling (default 120, so penalties are applied) |
| `AUTO_SETTLE_INTERVAL_MIN` | How often the server checks (default 5) |
After changing anything, tap Save, rebuild, and deploy.

## Turn on Google sign-in (free)
1. Go to console.cloud.google.com, create a project, open **APIs & Services > Credentials**.
2. Configure the consent screen (External, app name Apexly, your email).
3. **Create credentials > OAuth client ID > Web application.** Under **Authorized JavaScript origins** add your site address (for example `https://nitro-bet-web.onrender.com`, and your own domain later). No redirect address is needed.
4. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`). It is not a secret.
5. Put it in Render as `GOOGLE_CLIENT_ID`. Save, rebuild, deploy. The Google button appears.

## Look at the raw data (optional)
In your database provider's SQL screen (Neon: SQL Editor), these are safe read-only checks:
- `select count(*) from players;`
- `select count(*) from players where created_at > now() - interval '7 days';`
- `select title, status, model from markets order by created_at desc limit 5;`
Do not edit data by hand: the ledger blocks changes on purpose.

## When something goes wrong
- **"Invalid admin key"**: the key you typed differs from Render's. Re-run the command and paste it again from Render's copy icon.
- **Nothing happens for a minute**: the free server was asleep. Wait and retry.
- **Players see no drivers or chart**: there is no open market. Run `ops.sh create`.
- **Old fixed-odds market**: markets made before the pool update show no chart. Create a new one.
