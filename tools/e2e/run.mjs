import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { startMock } from './mock-api.mjs';
import { signPersonal, addressOfPrivateKey, toChecksumAddress } from '../../apps/nitro-backend/src/lib/eth.js';
const require = createRequire('/home/claude/.npm-global/lib/node_modules/');
const { chromium } = require('playwright');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const web = http.createServer((req, res) => { let p = new URL(req.url, 'http://x').pathname; if (p === '/') p = '/index.html'; const f = path.join('/tmp/e2e/site', p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await startMock(4777); await new Promise((r) => web.listen(4778, r));
const results = []; const ok = (name, cond, extra = '') => { results.push(cond); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`); };
const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36' });
const page = await ctx.newPage(); const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|favicon|net::/.test(m.text())) problems.push('console.error: ' + m.text()); });
const seen = (t, ms = 8000) => page.getByText(t, { exact: false }).first().waitFor({ timeout: ms }).then(() => true, () => false);
const state = async () => (await fetch('http://127.0.0.1:4777/__state')).json();
const fmtPts = (s) => Number(s).toLocaleString('en-US', { minimumFractionDigits: 2 });
const tokenNow = () => page.evaluate(() => localStorage.getItem('nitro_token'));
const tokenOn = (pg) => pg.evaluate(() => localStorage.getItem('nitro_token'));
try {
  await page.goto('http://127.0.0.1:4778/');
  ok('home loads with the free-to-play label', await seen('free to play'));
  ok('brand shows Apexly and the Net Race tagline', await seen('The Net Race'));
  ok('markets come from the server (Max Verstappen card)', await seen('Max Verstappen'));

  await page.getByRole('button', { name: 'Join free' }).first().click();
  await page.getByPlaceholder('Shown on the leaderboard').fill('Kingvibe');
  await page.getByPlaceholder('you@example.com').fill('king@example.test');
  await page.getByPlaceholder('At least 10 characters').fill('correct-horse-battery');
  await page.locator('input[type=date]').fill('2015-01-01');
  await page.getByRole('button', { name: 'CREATE FREE ACCOUNT' }).click();
  ok('sign-up without ticking the box is blocked', await seen('Please confirm you are 18 or older'));
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: 'CREATE FREE ACCOUNT' }).click();
  ok('under-18 date of birth is refused with a plain message', await seen('You must be 18 or older to join.'));
  await page.locator('input[type=date]').fill('1995-05-05');
  await page.getByRole('button', { name: 'CREATE FREE ACCOUNT' }).click();
  ok('valid sign-up logs in and shows 1,000.00 points', await seen('1,000.00'));
  ok('token is kept so a refresh stays signed in', !!(await tokenNow()));

  // first prediction (Verstappen)
  await page.getByText('PREDICT @').first().click();
  ok('pick lands on the prediction slip', await seen('PREDICTION SLIP (1)'));
  ok('slip shows an estimated win (not stake x odds)', await seen('Est. win'));
  await page.getByRole('button', { name: 'LOCK IN PREDICTIONS' }).click();
  ok('prediction locks in and a message confirms it', await seen('Prediction locked in.'));
  ok('balance on screen drops to 900.00', await seen('900.00'));

  // the points-pool chart
  ok('chart card is shown under the market', await page.getByTestId('market-chart').first().isVisible());
  ok('the chart gets a candle right after the prediction (no 30s wait)', await page.locator('[data-candle]').first().waitFor({ timeout: 8000 }).then(() => true, () => false));
  ok('chart says price = share of the pool and points have no cash value', await seen('Price = share of the points pool') && await seen('no cash value'));
  const chart = page.getByTestId('market-chart').first();
  const priceBefore = await chart.locator('span.font-racing').first().innerText();
  await chart.getByRole('button', { name: /Hamilton/i }).click(); await page.waitForTimeout(400);
  const priceAfter = await chart.locator('span.font-racing').first().innerText();
  ok('switching the outcome changes the chart price', priceBefore !== priceAfter, priceBefore + ' -> ' + priceAfter);
  await chart.getByRole('button', { name: '1h', exact: true }).click(); await page.waitForTimeout(600);
  ok('changing the interval asks the server for new candles', (await state()).requests.some((r) => /\/chart$/.test(r)));

  // second prediction (Norris)
  await page.getByText('PREDICT @').nth(1).click();
  await page.getByRole('button', { name: 'LOCK IN PREDICTIONS' }).click();
  ok('second prediction goes through; balance 800.00', await seen('Prediction locked in.') && await seen('800.00'));

  // account drawer
  await page.getByRole('button', { name: 'Account' }).first().click();
  ok('account drawer opens with Apex Points', await seen('Apex Points'));
  ok('free-to-play notice is on the points tab', await seen('no cash value'));
  await page.getByRole('button', { name: 'predictions', exact: true }).click();
  ok('predictions tab lists the picks as Open', await seen('Open') && await seen('Lando Norris'));
  await page.getByRole('button', { name: 'history', exact: true }).click();
  ok('history tab shows welcome points and predictions placed', await seen('Welcome points') && await seen('Prediction placed'));
  await page.getByRole('button', { name: 'settings', exact: true }).click();
  ok('install card is shown in settings', await page.getByTestId('install-card').first().isVisible());
  await page.locator('button[aria-pressed]').first().click();
  ok('ghost mode toggle saves (header says GHOST MODE ON)', await seen('👻 GHOST MODE ON'));
  await page.getByRole('button', { name: 'Close' }).click();

  // settle with real pool maths, then check leaderboard and real payout
  await fetch('http://127.0.0.1:4777/__settle'); await page.reload();
  ok('leaderboard shows a ghost tag, not the real display name', await seen('Ghost-') && !(await page.getByText('Kingvibe', { exact: true }).count()));
  ok('prizes are shown as coming soon (no payout claims)', await seen('Prizes: coming soon'));
  await page.getByRole('button', { name: 'Account' }).first().click();
  await page.getByRole('button', { name: 'predictions', exact: true }).click();
  const mine = (await (await fetch('http://127.0.0.1:4777/api/wagers', { headers: { Authorization: 'Bearer ' + await tokenNow() } })).json()).wagers;
  const won = mine.find((w) => w.status === 'won');
  ok('predictions tab shows Returned with the REAL payout, not the estimate', await seen('Returned') && await seen(fmtPts(won.payout)), 'payout ' + won.payout + ' vs estimate ' + won.potentialPayout);

  // sign out and back in
  await page.getByRole('button', { name: 'settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sign Out' }).click();
  ok('sign out clears the session and shows Join free again', await seen('Join free') && !(await tokenNow()));
  await page.getByRole('button', { name: 'Join free' }).first().click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.getByPlaceholder('you@example.com').fill('king@example.test');
  await page.getByPlaceholder('Your password').fill('wrong-password-here');
  await page.getByRole('button', { name: 'SIGN IN', exact: true }).click();
  ok('wrong password shows a clear message', await seen('Wrong email or password.'));
  await page.getByPlaceholder('Your password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'SIGN IN', exact: true }).click();
  await page.waitForFunction(() => !!localStorage.getItem('nitro_token'), null, { timeout: 8000 });
  const meNow = await (await fetch('http://127.0.0.1:4777/api/me', { headers: { Authorization: 'Bearer ' + await tokenNow() } })).json();
  ok('signing back in shows the balance after the pool payout (' + fmtPts(meNow.balance) + ')', await seen(fmtPts(meNow.balance)));
  ok('the winning pick paid more than its stake (balance above 1,000)', Number(meNow.balance) > 1000);

  await page.evaluate(() => localStorage.setItem('nitro_token', 'tok-expired')); await page.reload();
  ok('an expired token signs you out with a message', await seen('Your session expired'));

  // ================= community features: invite link, Google, wallet, social links =================
  const API = 'http://127.0.0.1:4777'; const WEB = 'http://127.0.0.1:4778';
  const kingLogin = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'king@example.test', password: 'correct-horse-battery' }) })).json();
  const kingCode = (await (await fetch(`${API}/api/me/referral`, { headers: { Authorization: 'Bearer ' + kingLogin.token } })).json()).code;
  const mkPage = async (c) => { const pg = await c.newPage(); pg.on('pageerror', (e) => problems.push('pageerror: ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|favicon|net::/.test(m.text())) problems.push('console.error: ' + m.text()); }); return pg; };
  const seenOn = (pg, t, ms = 8000) => pg.getByText(t, { exact: false }).first().waitFor({ timeout: ms }).then(() => true, () => false);
  const lsGet = (pg, k) => pg.evaluate((key) => localStorage.getItem(key), k);
  const mobile = { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36' };

  // --- A: password sign-up through an invite link; Google script cannot load (blocked) ---
  const ctxA = await browser.newContext(mobile);
  await ctxA.route('https://accounts.google.com/**', (r) => r.abort());
  const pA = await mkPage(ctxA);
  await pA.goto(`${WEB}/?ref=${kingCode.toLowerCase()}`);
  ok('invite link: ?ref=CODE is remembered (upper-cased) and removed from the address bar', await seenOn(pA, 'The Net Race') && (await lsGet(pA, 'apexly_ref')) === kingCode && !pA.url().includes('ref='), kingCode);
  const social = pA.getByTestId('social-links');
  ok('social links: only the configured ones are shown (Discord and X, not Instagram)', await social.waitFor({ timeout: 8000 }).then(() => true, () => false)
    && await social.getByRole('link', { name: 'Discord' }).isVisible() && await social.getByRole('link', { name: 'X', exact: true }).isVisible() && (await social.getByRole('link', { name: 'Instagram' }).count()) === 0);
  ok('social links open the configured address in a new tab', (await social.getByRole('link', { name: 'Discord' }).getAttribute('href')) === 'https://discord.gg/apexly-test' && (await social.getByRole('link', { name: 'Discord' }).getAttribute('target')) === '_blank');
  await pA.getByRole('button', { name: 'Join free' }).first().click();
  await pA.getByPlaceholder('Shown on the leaderboard').waitFor();
  await pA.waitForTimeout(500);
  ok('Google button stays hidden when Google\'s script cannot load (form still works)', !(await pA.getByTestId('google-button').isVisible()));
  await pA.getByPlaceholder('Shown on the leaderboard').fill('Friend One');
  await pA.getByPlaceholder('you@example.com').fill('friend1@example.test');
  await pA.getByPlaceholder('At least 10 characters').fill('another-long-password');
  await pA.locator('input[type=date]').fill('1996-06-06');
  await pA.locator('input[type=checkbox]').check();
  await pA.getByRole('button', { name: 'CREATE FREE ACCOUNT' }).click();
  ok('sign-up with an invite link works and shows 1,000.00 points', await seenOn(pA, '1,000.00'));
  const stA = await state();
  const regA = stA.registrations.find((r) => r.email === 'friend1@example.test');
  ok('the invite code is sent with the sign-up', regA?.ref === kingCode && regA?.via === 'password', JSON.stringify(regA));
  ok('the remembered code is cleared after sign-up', (await lsGet(pA, 'apexly_ref')) === null);
  await pA.getByRole('button', { name: 'Account' }).first().click();
  ok('account > points shows the invite card with a link ending in ?ref=<own code>', await pA.getByTestId('invite-link').waitFor({ timeout: 8000 }).then(() => true, () => false)
    && (await pA.getByTestId('invite-link').innerText()).includes('/?ref=') && !(await pA.getByTestId('invite-link').innerText()).includes(kingCode));
  ok('invite card explains the points bonus and the cap, points only', await seenOn(pA, '500 points') && await seenOn(pA, 'Up to 10 friends') && await seenOn(pA, 'no cash value'));
  ok('wallet card tells people without a wallet to open the site in their wallet app', await seenOn(pA, 'No wallet found in this browser') && await pA.getByRole('link', { name: 'MetaMask' }).isVisible());
  const kingRef = await (await fetch(`${API}/api/me/referral`, { headers: { Authorization: 'Bearer ' + kingLogin.token } })).json();
  ok('the inviter sees 1 invited friend', kingRef.invited === 1, JSON.stringify(kingRef));
  await ctxA.close();

  // --- B: Google sign-up (fake window.google) with 18+ step, then wallet link (fake window.ethereum signing with the real lib/eth.js) ---
  const PRIV = '4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';
  const walletAddr = addressOfPrivateKey(PRIV);
  const ctxB = await browser.newContext(mobile);
  await ctxB.exposeFunction('__signInNode', (message) => signPersonal(message, PRIV));
  await ctxB.addInitScript(({ addr }) => {
    window.__fakeCredential = 'fake:newbie@example.test:Test Newbie';
    window.google = { accounts: { id: {
      initialize: (cfg) => { window.__gsiCb = cfg.callback; window.__gsiClient = cfg.client_id; },
      renderButton: (el) => { el.innerHTML = '<button data-testid="fake-google">Continue with Google (fake)</button>'; el.firstChild.onclick = () => window.__gsiCb({ credential: window.__fakeCredential }); },
    } } };
    window.ethereum = { request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts') return [addr];
      if (method === 'personal_sign') return window.__signInNode(params[0]);
      throw new Error('unsupported ' + method);
    } };
  }, { addr: walletAddr });
  const pB = await mkPage(ctxB);
  await pB.goto(`${WEB}/?ref=ZEBRA234`);
  await seenOn(pB, 'The Net Race');
  await pB.getByRole('button', { name: 'Join free' }).first().click();
  const gbtn = pB.getByTestId('fake-google');
  ok('Google button is drawn into the sign-in box when a client id is configured', await gbtn.waitFor({ timeout: 8000 }).then(() => true, () => false) && await pB.getByText('or', { exact: true }).first().isVisible());
  ok('Google is initialised with the client id from /api/config', (await pB.evaluate(() => window.__gsiClient)) === 'test-client-id.apps.googleusercontent.com');
  await gbtn.click();
  ok('new Google person is asked for date of birth and the 18+ box first', await pB.getByTestId('google-signup-step').waitFor({ timeout: 8000 }).then(() => true, () => false) && await seenOn(pB, 'newbie@example.test'));
  await pB.getByRole('button', { name: 'CREATE FREE ACCOUNT' }).click();
  ok('the Google step will not continue without a date of birth', await seenOn(pB, 'Please enter your date of birth.') && !(await tokenOn(pB)));
  await pB.getByTestId('google-dob').fill('2015-01-01'); await pB.getByTestId('google-agree').check();
  await pB.getByRole('button', { name: 'CREATE FREE ACCOUNT' }).click();
  ok('under-18 on the Google step is refused with a plain message', await seenOn(pB, 'You must be 18 or older to join.') && !(await tokenOn(pB)));
  await pB.getByTestId('google-dob').fill('1990-01-01');
  await pB.getByRole('button', { name: 'CREATE FREE ACCOUNT' }).click();
  ok('adult finishes the Google sign-up and sees 1,000.00 points', await seenOn(pB, '1,000.00') && !!(await tokenOn(pB)));
  const regB = (await state()).registrations.find((r) => r.email === 'newbie@example.test');
  ok('Google sign-up carries the invite code, and it is cleared afterwards', regB?.ref === 'ZEBRA234' && regB?.via === 'google' && (await lsGet(pB, 'apexly_ref')) === null, JSON.stringify(regB));
  await pB.getByRole('button', { name: 'Account' }).first().click();
  await pB.getByTestId('wallet-card').waitFor({ timeout: 8000 });
  await pB.getByRole('button', { name: 'Connect wallet' }).click();
  const shortOf = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;
  ok('wallet links by signature and shows the short address', await seenOn(pB, 'Linked: ' + shortOf(toChecksumAddress(walletAddr))), shortOf(toChecksumAddress(walletAddr)));
  const wallets = Object.values((await state()).wallets);
  ok('server recovered the exact wallet address from the real signature', wallets.length === 1 && wallets[0] === walletAddr.toLowerCase());
  await pB.reload(); await pB.getByRole('button', { name: 'Account' }).first().click();
  ok('the linked wallet is still shown after a refresh', await seenOn(pB, 'Linked: ' + shortOf(toChecksumAddress(walletAddr))));
  // signing in again with the same Google account goes straight in (no second 18+ step)
  await pB.evaluate(() => localStorage.removeItem('nitro_token')); await pB.reload();
  await pB.getByRole('button', { name: 'Join free' }).first().click();
  await pB.getByTestId('fake-google').click();
  ok('returning Google person signs straight in', await seenOn(pB, '1,000.00') && !!(await tokenOn(pB)) && (await pB.getByTestId('google-signup-step').count()) === 0);
  await ctxB.close();
} catch (e) { ok('test run finished without throwing', false, e.message.split('\n')[0]); }
ok('no JavaScript errors in the browser', problems.length === 0, problems.slice(0, 3).join(' | '));
await browser.close(); process.exit(results.every(Boolean) ? 0 : 1);
