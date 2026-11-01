// Ethereum helpers with no dependencies: keccak-256, signature recovery (personal_sign) and address checks.
// Used to prove that a player controls a wallet. Signing is exported only for tests.

const M64 = (1n << 64n) - 1n;
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const rotl = (x, n) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M64);

function keccakF(s) {
  for (let round = 0; round < 24; round++) {
    const C = [];
    for (let x = 0; x < 5; x++) C[x] = s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20];
    for (let x = 0; x < 5; x++) {
      const D = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
      for (let y = 0; y < 25; y += 5) s[y + x] ^= D;
    }
    const B = new Array(25);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x + 5 * y]);
    for (let y = 0; y < 25; y += 5) for (let x = 0; x < 5; x++) s[y + x] = B[y + x] ^ ((~B[y + ((x + 1) % 5)] & M64) & B[y + ((x + 2) % 5)]);
    s[0] ^= RC[round];
  }
}

export function keccak256(data) {
  const bytes = Buffer.from(data);
  const rate = 136;
  const padded = Buffer.concat([bytes, Buffer.alloc(rate - (bytes.length % rate))]);
  padded[bytes.length] ^= 0x01;
  padded[padded.length - 1] ^= 0x80;
  const s = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) s[i] ^= padded.readBigUInt64LE(off + i * 8);
    keccakF(s);
  }
  const out = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) out.writeBigUInt64LE(s[i], i * 8);
  return out;
}

// ---- secp256k1 (affine coordinates, BigInt) ----
const P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
const N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const G = [0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n, 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n];
const mod = (a, m = P) => ((a % m) + m) % m;
const powmod = (b, e, m) => { let r = 1n; b = mod(b, m); while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; };
const inv = (a, m = P) => powmod(a, m - 2n, m);

function add(p, q) {
  if (!p) return q;
  if (!q) return p;
  const [x1, y1] = p, [x2, y2] = q;
  if (x1 === x2) {
    if (mod(y1 + y2) === 0n) return null;
    const l = mod(3n * x1 * x1 * inv(2n * y1));
    const x3 = mod(l * l - 2n * x1);
    return [x3, mod(l * (x1 - x3) - y1)];
  }
  const l = mod((y2 - y1) * inv(x2 - x1));
  const x3 = mod(l * l - x1 - x2);
  return [x3, mod(l * (x1 - x3) - y1)];
}
function mul(k, p) {
  let r = null, a = p;
  k = mod(k, N);
  while (k > 0n) { if (k & 1n) r = add(r, a); a = add(a, a); k >>= 1n; }
  return r;
}

const hex32 = (n) => n.toString(16).padStart(64, '0');
const addressOfPoint = ([x, y]) => '0x' + keccak256(Buffer.from(hex32(x) + hex32(y), 'hex')).subarray(12).toString('hex');

export const isAddress = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);

/** EIP-55 mixed-case form. */
export function toChecksumAddress(address) {
  const lower = address.toLowerCase().replace(/^0x/, '');
  const hash = keccak256(Buffer.from(lower, 'ascii')).toString('hex');
  return '0x' + [...lower].map((c, i) => (/[a-f]/.test(c) && parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c)).join('');
}

const personalHash = (message) => {
  const body = Buffer.from(message, 'utf8');
  return keccak256(Buffer.concat([Buffer.from(`\x19Ethereum Signed Message:\n${body.length}`, 'utf8'), body]));
};

/** The (lowercase) address that signed `message` with personal_sign. Throws if the signature is malformed. */
export function recoverAddress(message, signature) {
  const hex = String(signature).replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{130}$/.test(hex)) throw new Error('bad signature');
  const r = BigInt('0x' + hex.slice(0, 64)), s = BigInt('0x' + hex.slice(64, 128));
  let v = parseInt(hex.slice(128, 130), 16);
  if (v >= 27) v -= 27;
  if ((v !== 0 && v !== 1) || r <= 0n || r >= N || s <= 0n || s >= N) throw new Error('bad signature');
  const z = BigInt('0x' + personalHash(message).toString('hex'));
  const rhs = mod(r * r * r + 7n);
  let y = powmod(rhs, (P + 1n) / 4n, P);
  if (mod(y * y) !== rhs) throw new Error('bad signature');
  if ((y & 1n) !== BigInt(v)) y = P - y;
  const Q = mul(inv(r, N), add(mul(s, [r, y]), mul(N - mod(z, N), G)));
  if (!Q) throw new Error('bad signature');
  return addressOfPoint(Q);
}

// ---- for tests only ----
export const addressOfPrivateKey = (privHex) => addressOfPoint(mul(BigInt('0x' + privHex.replace(/^0x/, '')), G));
export function signPersonal(message, privHex) {
  const d = BigInt('0x' + privHex.replace(/^0x/, ''));
  const z = BigInt('0x' + personalHash(message).toString('hex'));
  for (let i = 0; ; i++) {
    const k = mod(BigInt('0x' + keccak256(Buffer.from(`${d}:${z}:${i}`)).toString('hex')), N);
    if (k === 0n) continue;
    const R = mul(k, G);
    const r = mod(R[0], N);
    let s = mod(inv(k, N) * (z + r * d), N);
    if (r === 0n || s === 0n) continue;
    let rec = Number(R[1] & 1n);
    if (s > N / 2n) { s = N - s; rec ^= 1; }
    return '0x' + hex32(r) + hex32(s) + (27 + rec).toString(16);
  }
}
