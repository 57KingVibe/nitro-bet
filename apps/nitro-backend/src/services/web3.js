import { randomBytes } from 'node:crypto';
import { pool } from '../config/db.js';
import { HttpError } from '../lib/http-error.js';
import { isAddress, recoverAddress, toChecksumAddress } from '../lib/eth.js';

const siteHost = () => { try { return new URL(process.env.PUBLIC_SITE_URL || 'https://nitro-bet-web.onrender.com').host; } catch { return 'apexly'; } };

export function buildWalletMessage({ domain, address, nonce, issuedAt, expiresAt }) {
  return [
    `${domain} wants you to link your Ethereum wallet.`, '',
    `Address: ${address}`,
    'Purpose: prove you own this wallet. It costs nothing and moves no funds.',
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt.toISOString()}`,
    `Expires: ${expiresAt.toISOString()}`,
  ].join('\n');
}

export async function getWallet(playerId) {
  const { rows } = await pool.query('SELECT address, linked_at FROM player_wallets WHERE player_id = $1', [playerId]);
  return rows[0] ? { address: toChecksumAddress(rows[0].address), linkedAt: rows[0].linked_at } : { address: null };
}

export async function createWalletChallenge(playerId, address) {
  if (!isAddress(address)) throw new HttpError(400, 'That does not look like an Ethereum address.', 'BAD_ADDRESS');
  const addr = address.toLowerCase();
  const { rows: taken } = await pool.query('SELECT player_id FROM player_wallets WHERE address = $1', [addr]);
  if (taken[0] && taken[0].player_id !== playerId) throw new HttpError(409, 'That wallet is already linked to another account.', 'WALLET_TAKEN');
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 10 * 60_000);
  const message = buildWalletMessage({ domain: siteHost(), address: toChecksumAddress(addr), nonce: randomBytes(12).toString('hex'), issuedAt, expiresAt });
  await pool.query(
    `INSERT INTO wallet_challenges (player_id, address, message, expires_at) VALUES ($1,$2,$3,$4)
     ON CONFLICT (player_id) DO UPDATE SET address = EXCLUDED.address, message = EXCLUDED.message, expires_at = EXCLUDED.expires_at`,
    [playerId, addr, message, expiresAt]);
  return { message, expiresAt };
}

export async function linkWallet(playerId, address, signature) {
  if (!isAddress(address)) throw new HttpError(400, 'That does not look like an Ethereum address.', 'BAD_ADDRESS');
  const addr = address.toLowerCase();
  const { rows } = await pool.query('SELECT address, message, expires_at FROM wallet_challenges WHERE player_id = $1', [playerId]);
  const ch = rows[0];
  if (!ch || ch.address !== addr) throw new HttpError(400, 'Start again: request a new signing message first.', 'NO_CHALLENGE');
  if (new Date(ch.expires_at) < new Date()) throw new HttpError(400, 'That signing message expired. Please try again.', 'CHALLENGE_EXPIRED');
  let signer;
  try { signer = recoverAddress(ch.message, signature); } catch { throw new HttpError(400, 'That signature is not valid.', 'BAD_SIGNATURE'); }
  if (signer !== addr) throw new HttpError(400, 'The signature does not match that wallet.', 'BAD_SIGNATURE');
  try {
    await pool.query(
      `INSERT INTO player_wallets (player_id, address) VALUES ($1,$2)
       ON CONFLICT (player_id) DO UPDATE SET address = EXCLUDED.address, linked_at = now()`, [playerId, addr]);
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'That wallet is already linked to another account.', 'WALLET_TAKEN');
    throw err;
  }
  await pool.query('DELETE FROM wallet_challenges WHERE player_id = $1', [playerId]);
  return { address: toChecksumAddress(addr) };
}
