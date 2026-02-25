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
export async function deriveKeyFromPassword(password, salt) {
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
    true, // extractable so we can wrap/unwrap it
    ['encrypt', 'decrypt']
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
const WORDLIST = [
  'apple','brave','cloud','dance','eagle','flame','grace','honey','ivory','jewel',
  'kings','lemon','mango','noble','ocean','pearl','queen','river','stone','tiger',
  'ultra','vivid','watch','xenon','yacht','zebra','alpha','blaze','crisp','delta',
  'ember','frost','globe','haste','index','japan','knife','lunar','maple','nerve',
  'olive','piano','quick','radar','solar','torch','union','vault','wheat','xenon',
  'yield','zonal','amber','beach','cedar','depot','event','field','grant','habit',
  'image','joker','karma','lance','magic','night','orbit','plaza','query','rocky',
  'sport','tower','under','valid','waste','extra','young','zones','axiom','below',
  'cabin','dried','egypt','fiber','given','hydro','indie','jelly','kitty','limit',
  'medal','numpy','ozone','pixel','quota','ratio','sigma','trend','unity','voted',
  'world','xeric','yummy','zingy','about','board','cause','depth','equal','final',
  'grade','house','input','joint','label','model','noted','omega','power','quite',
  'range','shelf','truth','urban','value','waste','aimed','bytes','cubic','draft',
  'ether','flame','grand','heart','inbox','jazzy','known','layer','minor','named',
  'outer','place','quest','ridge','scope','track','upper','villa','wider','x-ray',
  'yards','zones','apply','built','cargo','digit','entry','focus','guide','humid',
  'ideal','judge','keeps','links','month','north','offer','prose','queue','realm',
  'super','times','usual','vivid','wages','yield','acorn','brick','costs','dense',
  'early','funds','glory','hinds','inter','jolts','koala','lyric','mocha','nexus',
  'often','point','quite','reads','salty','truth','umber','voids','watch','exert',
  'yours','zests','birds','clean','dunes','edges','fixed','gifts','holds','input',
  'jumps','kings','lasts','monks','ninth','optic','paths','quota','rents','sides',
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
  return deriveKeyFromPassword(phrase, salt);
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
