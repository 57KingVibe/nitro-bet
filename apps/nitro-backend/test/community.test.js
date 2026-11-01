import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign, createECDH } from 'node:crypto';
import { keccak256, recoverAddress, signPersonal, addressOfPrivateKey, toChecksumAddress, isAddress } from '../src/lib/eth.js';
import { verifyGoogleIdToken } from '../src/lib/google.js';
import { generateReferralCode, normalizeRef } from '../src/lib/referral.js';
import { socialLinks } from '../src/lib/social.js';

const hex = (b) => Buffer.from(b).toString('hex');

test('keccak256 matches the published test vectors', () => {
  assert.equal(hex(keccak256('')), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(hex(keccak256('abc')), '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  assert.equal(hex(keccak256('a'.repeat(200))).length, 64);   // longer than one block works
});

test('address of private key 1 is the well-known one, and matches Node\'s own secp256k1', () => {
  const one = '0'.repeat(63) + '1';
  assert.equal(toChecksumAddress(addressOfPrivateKey(one)), '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf');
  const ecdh = createECDH('secp256k1');
  const priv = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
  ecdh.setPrivateKey(Buffer.from(priv, 'hex'));
  const nodePub = ecdh.getPublicKey().subarray(1);           // drop the 0x04 prefix
  const expected = '0x' + hex(keccak256(nodePub).subarray(12));
  assert.equal(addressOfPrivateKey(priv), expected);          // my curve maths agrees with OpenSSL
});

test('a personal_sign signature recovers to the signer, and only the signer', () => {
  const priv = '4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318';
  const me = addressOfPrivateKey(priv);
  const msg = 'Link this wallet to my Apexly account.\nNonce: abc123';
  const sig = signPersonal(msg, priv);
  assert.equal(recoverAddress(msg, sig), me);
  assert.notEqual(recoverAddress(msg + ' ', sig), me);        // a changed message recovers someone else
  const other = addressOfPrivateKey('0'.repeat(63) + '2');
  assert.notEqual(recoverAddress(msg, signPersonal(msg, '0'.repeat(63) + '2')), me);
  assert.equal(recoverAddress(msg, signPersonal(msg, '0'.repeat(63) + '2')), other);
  assert.throws(() => recoverAddress(msg, '0x1234'));
  assert.throws(() => recoverAddress(msg, '0x' + '00'.repeat(65)));
});

test('isAddress and checksum', () => {
  assert.ok(isAddress('0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf'));
  assert.ok(!isAddress('0x123'));
  assert.ok(!isAddress('7E5F4552091A69125d5DfCb7b8C2659029395Bdf'));
  assert.equal(toChecksumAddress('0x7e5f4552091a69125d5dfcb7b8c2659029395bdf'), '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf');
});

// ---- Google ID tokens, signed with a throwaway RSA key and served from a fake key list ----
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const getKeys = async () => [jwk];
const CLIENT = 'client-123.apps.googleusercontent.com';
const NOW = 1_800_000_000_000;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(over = {}, { key = privateKey, kid = 'k1' } = {}) {
  const head = b64({ alg: 'RS256', kid, typ: 'JWT' });
  const body = b64({ iss: 'https://accounts.google.com', aud: CLIENT, sub: '1234567890', email: 'Fan@Example.com', email_verified: true, name: 'Fast Fan', exp: NOW / 1000 + 3600, ...over });
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(key).toString('base64url');
  return `${head}.${body}.${sig}`;
}
const verify = (t) => verifyGoogleIdToken(t, { clientId: CLIENT, now: NOW, getKeys });

test('Google token: a good token gives the verified email, lowercased', async () => {
  const g = await verify(token());
  assert.deepEqual(g, { sub: '1234567890', email: 'fan@example.com', name: 'Fast Fan' });
});

test('Google token: wrong audience, expired, unverified email, wrong key, unknown key id, junk are all refused', async () => {
  for (const t of [
    token({ aud: 'someone-else' }),
    token({ exp: NOW / 1000 - 7200 }),
    token({ email_verified: false }),
    token({ iss: 'https://evil.example' }),
    token({}, { key: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey }),
    token({}, { kid: 'nope' }),
    'not.a.token', 'x',
  ]) await assert.rejects(() => verify(t), (e) => e.code === 'BAD_GOOGLE_TOKEN');
});

test('referral codes: right shape, normalised, unique enough', () => {
  const codes = new Set(Array.from({ length: 500 }, generateReferralCode));
  assert.equal(codes.size, 500);
  for (const c of codes) assert.match(c, /^[A-Z2-9]{8}$/);
  assert.equal(normalizeRef(' abcd2345 '), 'ABCD2345');
  assert.equal(normalizeRef('ABCD234'), null);
  assert.equal(normalizeRef('ABCD2340'), null);   // 0 is not in the alphabet
  assert.equal(normalizeRef(undefined), null);
});

test('social links: only valid https links survive', () => {
  const out = socialLinks({ SOCIAL_X_URL: 'https://x.com/apexly', SOCIAL_DISCORD_URL: 'http://insecure.example', SOCIAL_TIKTOK_URL: 'not a url', SOCIAL_MEDIUM_URL: '' });
  assert.deepEqual(Object.keys(out), ['x']);
  assert.deepEqual(socialLinks({}), {});
});
