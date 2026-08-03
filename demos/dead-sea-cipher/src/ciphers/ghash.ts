/**
 * GHASH — the authentication half of AES-GCM (NIST SP 800-38D).
 *
 * The page used to *narrate* GHASH: a schematic box labelled "→ GHASH" and a
 * timed animation that coloured the tag red after a tamper. Nothing was
 * computed, so the headline claim — "one flipped ciphertext byte changes the
 * entire GHASH output" — was a caption rather than a result.
 *
 * This module computes it for real, over the ciphertext bytes the page is
 * displaying, so the claim is a measurement:
 *
 *   H       = E_K(0^128)                       the hash subkey
 *   GHASH   = ((…((C_1·H) ⊕ C_2)·H … ) ⊕ len)·H   in GF(2^128)
 *   tag     = GHASH ⊕ E_K(J0),  J0 = IV ‖ 0x00000001   (96-bit IV)
 *
 * Web Crypto exposes no ECB mode, so the two raw AES block encryptions are
 * obtained through AES-CTR: encrypting a single all-zero block with the
 * counter set to B yields the keystream block E_K(B) ⊕ 0 = E_K(B). Only one
 * block is ever requested, so the counter never increments.
 *
 * The result is checkable rather than asserted: `computeGcmTag` recomputes the
 * tag Web Crypto already produced, and the page compares them byte for byte.
 */

/** GF(2^128) reduction polynomial x^128 + x^7 + x^2 + x + 1, top word. */
const R0 = 0xe1000000;

function toWords(bytes: Uint8Array): Uint32Array {
  const w = new Uint32Array(4);
  for (let i = 0; i < 4; i++) {
    w[i] =
      ((bytes[i * 4] << 24) |
        (bytes[i * 4 + 1] << 16) |
        (bytes[i * 4 + 2] << 8) |
        bytes[i * 4 + 3]) >>>
      0;
  }
  return w;
}

function fromWords(w: Uint32Array): Uint8Array {
  const b = new Uint8Array(16);
  for (let i = 0; i < 4; i++) {
    b[i * 4] = (w[i] >>> 24) & 0xff;
    b[i * 4 + 1] = (w[i] >>> 16) & 0xff;
    b[i * 4 + 2] = (w[i] >>> 8) & 0xff;
    b[i * 4 + 3] = w[i] & 0xff;
  }
  return b;
}

/**
 * Carry-less multiply in GF(2^128) with GCM's bit ordering (bit 0 is the most
 * significant bit of byte 0). Shift-and-add, 128 rounds — slow next to a
 * table-driven implementation, and deliberately so: this is the textbook
 * algorithm from SP 800-38D §6.3 with nothing folded away.
 */
export function gf128Mul(xBytes: Uint8Array, yBytes: Uint8Array): Uint8Array {
  const x = toWords(xBytes);
  const v = toWords(yBytes);
  const z = new Uint32Array(4);

  for (let i = 0; i < 128; i++) {
    if ((x[i >>> 5] >>> (31 - (i & 31))) & 1) {
      z[0] ^= v[0];
      z[1] ^= v[1];
      z[2] ^= v[2];
      z[3] ^= v[3];
    }
    const lsb = v[3] & 1;
    v[3] = ((v[3] >>> 1) | (v[2] << 31)) >>> 0;
    v[2] = ((v[2] >>> 1) | (v[1] << 31)) >>> 0;
    v[1] = ((v[1] >>> 1) | (v[0] << 31)) >>> 0;
    v[0] = v[0] >>> 1;
    if (lsb) v[0] = (v[0] ^ R0) >>> 0;
  }

  return fromWords(z);
}

/** GHASH_H(A, C) — zero-padded AAD blocks, then ciphertext blocks, then lengths. */
export function ghash(h: Uint8Array, aad: Uint8Array, ct: Uint8Array): Uint8Array {
  let y: Uint8Array = new Uint8Array(16);

  const absorb = (data: Uint8Array): void => {
    for (let off = 0; off < data.length; off += 16) {
      const block = new Uint8Array(16);
      block.set(data.subarray(off, Math.min(off + 16, data.length)));
      for (let i = 0; i < 16; i++) block[i] ^= y[i];
      y = gf128Mul(block, h);
    }
  };

  absorb(aad);
  absorb(ct);

  const lenBlock = new Uint8Array(16);
  const view = new DataView(lenBlock.buffer);
  view.setBigUint64(0, BigInt(aad.length) * 8n);
  view.setBigUint64(8, BigInt(ct.length) * 8n);
  for (let i = 0; i < 16; i++) lenBlock[i] ^= y[i];

  return gf128Mul(lenBlock, h);
}

/** E_K(block) for a single AES block, via a one-block AES-CTR keystream. */
export async function aesBlockEncrypt(
  keyBytes: Uint8Array,
  block: Uint8Array
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'AES-CTR' },
    false,
    ['encrypt']
  );
  const keystream = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: block as unknown as BufferSource, length: 32 },
    key,
    new Uint8Array(16) as unknown as BufferSource
  );
  return new Uint8Array(keystream);
}

export interface GcmTagParts {
  /** H = E_K(0^128), the GHASH subkey. */
  hashSubkey: Uint8Array;
  /** Raw GHASH output over (AAD, ciphertext). */
  ghashOut: Uint8Array;
  /** E_K(J0), the value GHASH is masked with to form the tag. */
  mask: Uint8Array;
  /** The 128-bit authentication tag. */
  tag: Uint8Array;
  /** Number of 16-byte GHASH blocks absorbed, excluding the length block. */
  blocks: number;
}

/**
 * Recompute the GCM tag for a ciphertext from the raw key and the 96-bit IV.
 * Every field is derived here; nothing is read back from Web Crypto's output.
 */
export async function computeGcmTag(
  keyBytes: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array = new Uint8Array(0)
): Promise<GcmTagParts> {
  if (iv.length !== 12) {
    throw new Error('computeGcmTag: this demo only handles the 96-bit IV case');
  }

  const hashSubkey = await aesBlockEncrypt(keyBytes, new Uint8Array(16));

  const j0 = new Uint8Array(16);
  j0.set(iv);
  j0[15] = 1;
  const mask = await aesBlockEncrypt(keyBytes, j0);

  const ghashOut = ghash(hashSubkey, aad, ciphertext);

  const tag = new Uint8Array(16);
  for (let i = 0; i < 16; i++) tag[i] = ghashOut[i] ^ mask[i];

  return {
    hashSubkey,
    ghashOut,
    mask,
    tag,
    blocks: Math.ceil(aad.length / 16) + Math.ceil(ciphertext.length / 16),
  };
}

/** Count differing bits between two equal-length byte strings. */
export function bitDifference(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) throw new Error('bitDifference: length mismatch');
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    let x = a[i] ^ b[i];
    while (x) {
      n += x & 1;
      x >>>= 1;
    }
  }
  return n;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
