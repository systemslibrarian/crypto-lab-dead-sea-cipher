/**
 * AES-256-GCM — Advanced Encryption Standard with Galois/Counter Mode.
 * Selected by NIST: October 2000. Published as FIPS 197: November 26, 2001.
 * Uses Web Crypto API (crypto.subtle) — no external libraries.
 * Key derivation: PBKDF2-SHA256, 200,000 iterations.
 */

export interface AESPayload {
  ciphertext: string; // base64
  iv: string;         // base64
  salt: string;       // base64
  tag: string;        // base64 — GCM authentication tag
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * The 256 raw key bits PBKDF2 produces. Exported because the GHASH exhibit
 * needs the same key Web Crypto sealed with in order to recompute H = E_K(0)
 * and the tag mask E_K(J0) — values it cannot get out of an AES-GCM CryptoKey,
 * which is deliberately non-extractable.
 */
export async function deriveKeyBytes(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 200000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return new Uint8Array(bits);
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyBytes = await deriveKeyBytes(passphrase, salt);
  return crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function aesEncrypt(plaintext: string, passphrase: string): Promise<AESPayload> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
    key,
    encoder.encode(plaintext)
  );

  // Web Crypto appends the 16-byte GCM auth tag to the ciphertext
  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertextBytes = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const tagBytes = encryptedBytes.slice(encryptedBytes.length - 16);

  return {
    ciphertext: toBase64(ciphertextBytes),
    iv: toBase64(iv),
    salt: toBase64(salt),
    tag: toBase64(tagBytes),
  };
}

export async function aesDecrypt(payload: AESPayload, passphrase: string): Promise<string> {
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const ciphertextBytes = fromBase64(payload.ciphertext);
  const tagBytes = fromBase64(payload.tag);
  const key = await deriveKey(passphrase, salt);

  // Reassemble ciphertext + tag for Web Crypto
  const combined = new Uint8Array(ciphertextBytes.length + tagBytes.length);
  combined.set(ciphertextBytes);
  combined.set(tagBytes, ciphertextBytes.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
    key,
    combined
  );

  return new TextDecoder().decode(decrypted);
}

export async function aesVerifyIntegrity(payload: AESPayload, passphrase: string): Promise<boolean> {
  try {
    await aesDecrypt(payload, passphrase);
    return true;
  } catch {
    return false;
  }
}

/**
 * Flip one bit of the ciphertext. The learner chooses which: `byteIndex` picks
 * the byte, `bitIndex` the bit within it (0 = least significant). Both are
 * clamped to the ciphertext, so the caller cannot silently miss.
 *
 * GCM's tag covers every ciphertext byte, so which bit is flipped should make
 * no difference to whether verification fails — that invariance is the lesson,
 * and it can only be seen if the position is a lever rather than a constant.
 */
export function tamperWithCiphertext(
  payload: AESPayload,
  byteIndex = 0,
  bitIndex = 0
): AESPayload {
  const bytes = fromBase64(payload.ciphertext);
  if (bytes.length > 0) {
    const i = Math.min(Math.max(Math.trunc(byteIndex), 0), bytes.length - 1);
    const b = Math.min(Math.max(Math.trunc(bitIndex), 0), 7);
    bytes[i] ^= 1 << b;
  }
  return {
    ...payload,
    ciphertext: toBase64(bytes),
  };
}

export { toBase64, fromBase64 };
