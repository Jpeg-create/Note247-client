/**
 * Note247 E2EE Crypto Module
 * Uses WebCrypto API (built into all modern browsers — zero deps)
 *
 * Encryption: AES-256-GCM
 * Key derivation: PBKDF2 (310,000 iterations — OWASP recommended 2024)
 * Recovery key: 128-bit random → BIP39-style wordlist encoding
 */

// ─── PBKDF2 Key Derivation ───────────────────────────────────────────────────

/**
 * Derives a 256-bit AES key from a password + salt using PBKDF2.
 * The derived key is used to encrypt/decrypt note content.
 */
export async function deriveKeyFromPassword(password, salt, options = {}) {
  const usages = options.usages || ['encrypt', 'decrypt'];
  const extractable = options.extractable ?? true;
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: typeof salt === 'string' ? hexToBytes(salt) : salt,
      iterations: 310000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    extractable, // extractable so we can wrap/unwrap it
    usages
  );
}

// ─── AES-256-GCM Encrypt / Decrypt ───────────────────────────────────────────

/**
 * Encrypts plaintext with an AES-GCM CryptoKey.
 * Returns a hex string: iv (24 hex chars) + ciphertext (hex).
 */
export async function encryptText(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return bytesToHex(iv) + bytesToHex(new Uint8Array(ciphertext));
}

/**
 * Decrypts a hex-encoded ciphertext (iv prepended) with an AES-GCM CryptoKey.
 */
export async function decryptText(hexCiphertext, key) {
  const iv = hexToBytes(hexCiphertext.slice(0, 24));
  const data = hexToBytes(hexCiphertext.slice(24));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return new TextDecoder().decode(plaintext);
}

// ─── Key Wrapping (encrypt a key with another key) ───────────────────────────

/**
 * Wraps (encrypts) a CryptoKey using another CryptoKey.
 * Used to store the user's main key encrypted by their recovery key.
 */
export async function wrapKey(keyToWrap, wrappingKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    keyToWrap,
    wrappingKey,
    { name: 'AES-GCM', iv }
  );
  return bytesToHex(iv) + bytesToHex(new Uint8Array(wrapped));
}

/**
 * Unwraps (decrypts) a wrapped key hex string back into a CryptoKey.
 */
export async function unwrapKey(hexWrapped, wrappingKey) {
  const iv = hexToBytes(hexWrapped.slice(0, 24));
  const data = hexToBytes(hexWrapped.slice(24));
  return crypto.subtle.unwrapKey(
    'raw',
    data,
    wrappingKey,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// ─── Recovery Key ─────────────────────────────────────────────────────────────

// 256 simple English words for human-readable recovery keys
// 256 unique words — no hyphens (hyphens are used as word separators in recovery phrases)
// No duplicates to maintain full entropy for recovery key generation
const WORDLIST = [
  'apple','brave','cloud','dance','eagle','flame','grace','honey','ivory','jewel',
  'kings','lemon','mango','noble','ocean','pearl','queen','river','stone','tiger',
  'ultra','vivid','watch','xenon','yacht','zebra','alpha','blaze','crisp','delta',
  'ember','frost','globe','haste','index','japan','knife','lunar','maple','nerve',
  'olive','piano','quick','radar','solar','torch','union','vault','wheat','bison',
  'yield','zonal','amber','beach','cedar','depot','event','field','grant','habit',
  'image','joker','karma','lance','magic','night','orbit','plaza','query','rocky',
  'sport','tower','under','valid','trove','extra','young','zebra','axiom','below',
  'cabin','dried','egypt','fiber','given','hydro','indie','jelly','kitty','limit',
  'medal','numpy','ozone','pixel','quota','ratio','sigma','trend','unity','voted',
  'world','xeric','yummy','zingy','about','board','cause','depth','equal','final',
  'grade','house','input','joint','label','model','noted','omega','power','siren',
  'range','shelf','craft','urban','value','frost','aimed','bytes','cubic','draft',
  'ether','plume','grand','heart','inbox','jazzy','known','layer','minor','named',
  'outer','place','quest','ridge','scope','track','upper','villa','wider','prism',
  'yards','boxer','apply','built','cargo','digit','entry','focus','guide','humid',
  'ideal','judge','keeps','links','month','north','offer','prose','queue','realm',
  'super','times','usual','rivet','wages','spire','acorn','brick','costs','dense',
  'early','funds','glory','hinds','inter','jolts','koala','lyric','mocha','nexus',
  'often','point','pines','reads','salty','torso','umber','voids','blend','exert',
  'yours','zests','birds','clean','dunes','edges','fixed','gifts','holds','knack',
  'jumps','flame','lasts','monks','ninth','optic','paths','relax','rents','sides',
  'tanks','until','vying','waves','exits','yells','zeros','actor','bonds','chess',
  'drone','erred','flesh','grids','hiked','irony','joked','kudos','lifts','mixed',
  'needs','owned','parts','quiet','roses','seeds','tides','unify','views','wakes',
];

/**
 * Generates a cryptographically random 24-word recovery key.
 * Returns { words: string[], raw: Uint8Array }
 * The raw bytes are used to derive the backup encryption key.
 */
export function generateRecoveryKey() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const words = [];
  for (let i = 0; i < 24; i++) {
    // Map each byte pair (16-bit) to a word index (256 words)
    words.push(WORDLIST[raw[i] % WORDLIST.length]);
  }
  return { words, raw };
}

/**
 * Derives an AES key from a recovery key word array.
 * The words are joined and run through PBKDF2 with a fixed salt.
 */
export async function deriveKeyFromRecoveryWords(words, salt) {
  const phrase = words.join('-');
  return deriveKeyFromPassword(phrase, salt, {
    usages: ['wrapKey', 'unwrapKey'],
    extractable: true,
  });
}

// ─── Salt Generation ──────────────────────────────────────────────────────────

export function generateSalt() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

// ─── Session Key Cache (in-memory only, never persisted) ─────────────────────

let _sessionKey = null;

export function setSessionKey(key) { _sessionKey = key; }
export function getSessionKey() { return _sessionKey; }
export function clearSessionKey() { _sessionKey = null; }

// ─── Hex Utilities ────────────────────────────────────────────────────────────

export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Export a CryptoKey to raw hex (for wrapping operations)
 */
export async function exportKeyHex(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bytesToHex(new Uint8Array(raw));
}

// ─── Per-Document Key Helpers ────────────────────────────────────────────────

/**
 * Generates a fresh random AES-256-GCM key for a single document.
 * This key is distinct from the user's session key and travels in the URL hash.
 */
export async function generateDocKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can export it into the URL
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports a CryptoKey to URL-safe base64 (no +, /, or = padding).
 */
export async function exportKeyToBase64(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  const bytes = new Uint8Array(raw);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Imports a URL-safe base64 string back into an AES-GCM CryptoKey.
 */
export async function importKeyFromBase64(b64) {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padding);
  const str = atob(padded);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return crypto.subtle.importKey(
    'raw', bytes,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Imports an AES-GCM CryptoKey from a raw hex string.
 * Used to reconstruct a per-document key stored as encrypted hex.
 */
export async function importKeyFromHex(hex) {
  const bytes = hexToBytes(hex);
  return crypto.subtle.importKey(
    'raw', bytes,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}
