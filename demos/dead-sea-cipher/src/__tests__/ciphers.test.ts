import { describe, it, expect } from 'vitest';
import { atbash, atbashHebrew } from '../ciphers/atbash.ts';
import { caesarEncrypt, caesarDecrypt, caesarBruteForce } from '../ciphers/caesar.ts';
import { vigenereEncrypt, vigenereDecrypt } from '../ciphers/vigenere.ts';
import { generateOTPKey, otpEncrypt, otpDecrypt, otpKeyReuseAttack, textToBytes, bytesToText } from '../ciphers/otp.ts';
import { letterFrequency, indexOfCoincidence, chiSquaredFitness } from '../analysis/frequency.ts';
import { kasiskiExamination } from '../analysis/kasiski.ts';
import { crackCaesar } from '../analysis/caesar-crack.ts';
import { aesEncrypt, aesDecrypt, aesVerifyIntegrity, tamperWithCiphertext, deriveKeyBytes, fromBase64 } from '../ciphers/aes.ts';
import {
  gf128Mul,
  aesBlockEncrypt,
  computeGcmTag,
  bitDifference,
  bytesToHex as bytesToHexGhash,
} from '../ciphers/ghash.ts';

describe('Atbash cipher', () => {
  it('encrypts BABEL to YZYVO (latin)', () => {
    expect(atbash('BABEL', 'latin')).toBe('YZYVO');
  });

  it('is its own inverse (latin)', () => {
    expect(atbash(atbash('HELLO WORLD', 'latin'), 'latin')).toBe('HELLO WORLD');
  });

  it('preserves case', () => {
    expect(atbash('Hello', 'latin')).toBe('Svool');
  });

  it('passes non-alpha through', () => {
    expect(atbash('A-B-C!', 'latin')).toBe('Z-Y-X!');
  });

  it('encodes BBL to ShShK (hebrew-transliterated)', () => {
    expect(atbash('BBL', 'hebrew-transliterated')).toBe('ShShK');
  });

  it('encodes Hebrew script: בבל → ששך', () => {
    expect(atbashHebrew('בבל')).toBe('ששך');
  });

  it('decodes Hebrew script: ששך → בבל', () => {
    expect(atbashHebrew('ששך')).toBe('בבל');
  });
});

describe('Caesar cipher', () => {
  it('encrypts ATTACK AT DAWN with shift 3', () => {
    expect(caesarEncrypt('ATTACK AT DAWN', 3)).toBe('DWWDFN DW GDZQ');
  });

  it('decrypts DWWDFN DW GDZQ with shift 3', () => {
    expect(caesarDecrypt('DWWDFN DW GDZQ', 3)).toBe('ATTACK AT DAWN');
  });

  it('encrypt then decrypt is identity', () => {
    expect(caesarDecrypt(caesarEncrypt('HELLO', 7), 7)).toBe('HELLO');
  });

  it('brute force returns 26 results', () => {
    const results = caesarBruteForce('DWWDFN DW GDZQ');
    expect(results).toHaveLength(26);
    const shift3 = results.find(r => r.shift === 3);
    expect(shift3?.plaintext).toBe('ATTACK AT DAWN');
  });

  it('preserves non-alpha characters', () => {
    expect(caesarEncrypt('HELLO, WORLD!', 3)).toBe('KHOOR, ZRUOG!');
  });
});

describe('Vigenère cipher', () => {
  it('encrypts ATTACKATDAWN with key LEMON', () => {
    expect(vigenereEncrypt('ATTACKATDAWN', 'LEMON')).toBe('LXFOPVEFRNHR');
  });

  it('decrypts LXFOPVEFRNHR with key LEMON', () => {
    expect(vigenereDecrypt('LXFOPVEFRNHR', 'LEMON')).toBe('ATTACKATDAWN');
  });

  it('encrypt then decrypt is identity', () => {
    const text = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG';
    const key = 'SECRET';
    expect(vigenereDecrypt(vigenereEncrypt(text, key), key)).toBe(text);
  });

  it('throws on empty key', () => {
    expect(() => vigenereEncrypt('HELLO', '')).toThrow();
  });
});

describe('One-Time Pad', () => {
  it('generates key of correct length', () => {
    const key = generateOTPKey(32);
    expect(key.length).toBe(32);
  });

  it('encrypts and decrypts correctly', () => {
    const plaintext = textToBytes('HELLO');
    const key = generateOTPKey(plaintext.length);
    const ciphertext = otpEncrypt(plaintext, key);
    const decrypted = otpDecrypt(ciphertext, key);
    expect(bytesToText(decrypted)).toBe('HELLO');
  });

  it('key reuse attack: C1 XOR C2 = P1 XOR P2', () => {
    const p1 = textToBytes('HELLO');
    const p2 = textToBytes('WORLD');
    const key = generateOTPKey(5);
    const c1 = otpEncrypt(p1, key);
    const c2 = otpEncrypt(p2, key);

    const xorCiphers = otpKeyReuseAttack(c1, c2);

    // Should equal P1 XOR P2
    const xorPlains = new Uint8Array(5);
    for (let i = 0; i < 5; i++) {
      xorPlains[i] = p1[i] ^ p2[i];
    }
    expect(xorCiphers).toEqual(xorPlains);
  });

  it('throws if key is shorter than plaintext', () => {
    const plaintext = textToBytes('HELLO');
    const shortKey = generateOTPKey(3);
    expect(() => otpEncrypt(plaintext, shortKey)).toThrow();
  });
});

describe('Frequency analysis', () => {
  it('returns E as most frequent in ETAOIN', () => {
    const result = letterFrequency('ETAOIN');
    // All letters appear once, so all have same frequency
    // But in longer English text, E should dominate
    expect(result[0].count).toBe(1);
    expect(result.length).toBe(26);
  });

  it('correctly counts frequencies', () => {
    const result = letterFrequency('AAABBC');
    const a = result.find(r => r.letter === 'A')!;
    const b = result.find(r => r.letter === 'B')!;
    const c = result.find(r => r.letter === 'C')!;
    expect(a.count).toBe(3);
    expect(b.count).toBe(2);
    expect(c.count).toBe(1);
    expect(a.percentage).toBeCloseTo(50, 0);
  });

  it('index of coincidence is ~0.065 for English', () => {
    // A longer sample with natural English letter distribution
    const english = 'IT WAS THE BEST OF TIMES IT WAS THE WORST OF TIMES IT WAS THE AGE OF WISDOM IT WAS THE AGE OF FOOLISHNESS IT WAS THE EPOCH OF BELIEF IT WAS THE EPOCH OF INCREDULITY IT WAS THE SEASON OF LIGHT IT WAS THE SEASON OF DARKNESS IT WAS THE SPRING OF HOPE IT WAS THE WINTER OF DESPAIR';
    const ic = indexOfCoincidence(english);
    expect(ic).toBeGreaterThan(0.05);
    expect(ic).toBeLessThan(0.09);
  });

  it('chi-squared is lower for English-like text', () => {
    const english = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG';
    const random = 'XQZJKWVP BMNFL GTHY ZCXQR JWKP';
    expect(chiSquaredFitness(english)).toBeLessThan(chiSquaredFitness(random));
  });
});

describe('Kasiski examination', () => {
  it('finds correct key length for Vigenère ciphertext', () => {
    // Encrypt a long text with key "LEMON" (length 5)
    const plaintext = 'TOBE OR NOT TOBE THAT IS THE QUESTION WHETHER TIS NOBLER IN THE MIND TO SUFFER THE SLINGS AND ARROWS OF OUTRAGEOUS FORTUNE';
    const key = 'LEMON';
    const ciphertext = vigenereEncrypt(plaintext.replace(/ /g, ''), key);
    const result = kasiskiExamination(ciphertext);
    expect(result.candidateLengths).toContain(5);
  });

  it('returns explanation text', () => {
    const ciphertext = vigenereEncrypt('ATTACKATDAWNATTACKATDAWNATTACKATDAWN', 'KEY');
    const result = kasiskiExamination(ciphertext);
    expect(result.explanation).toContain('Kasiski');
    expect(result.explanation.length).toBeGreaterThan(50);
  });
});

describe('Caesar cracking', () => {
  it('cracks DWWDFN DW GDZQ as shift 3', () => {
    const result = crackCaesar('DWWDFN DW GDZQ');
    expect(result.likelyShift).toBe(3);
  });

  it('cracks a longer cipher text', () => {
    const plaintext = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG';
    const encrypted = caesarEncrypt(plaintext, 13);
    const result = crackCaesar(encrypted);
    expect(result.likelyShift).toBe(13);
  });

  it('returns all 26 decryptions', () => {
    const result = crackCaesar('HELLO');
    expect(result.allDecryptions).toHaveLength(26);
  });
});

describe('AES-256-GCM', () => {
  const passphrase = 'correct horse battery staple';
  const message = 'The arc of cryptography bends toward authenticated encryption.';

  it('round-trips encrypt → decrypt', async () => {
    const payload = await aesEncrypt(message, passphrase);
    const decrypted = await aesDecrypt(payload, passphrase);
    expect(decrypted).toBe(message);
  });

  it('produces a fresh random IV and salt per encryption', async () => {
    const a = await aesEncrypt(message, passphrase);
    const b = await aesEncrypt(message, passphrase);
    // Same plaintext + passphrase, but unique IV/salt => different ciphertext.
    expect(a.iv).not.toBe(b.iv);
    expect(a.salt).not.toBe(b.salt);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('fails to decrypt with the wrong passphrase', async () => {
    const payload = await aesEncrypt(message, passphrase);
    await expect(aesDecrypt(payload, 'wrong passphrase')).rejects.toThrow();
  });

  it('verifies integrity of an untampered payload', async () => {
    const payload = await aesEncrypt(message, passphrase);
    expect(await aesVerifyIntegrity(payload, passphrase)).toBe(true);
  });

  it('detects tampering: a single flipped bit fails the GCM auth tag', async () => {
    const payload = await aesEncrypt(message, passphrase);
    const tampered = tamperWithCiphertext(payload);
    expect(tampered.ciphertext).not.toBe(payload.ciphertext);
    expect(await aesVerifyIntegrity(tampered, passphrase)).toBe(false);
    await expect(aesDecrypt(tampered, passphrase)).rejects.toThrow();
  });

  it('rejects a tamper at any learner-chosen byte and bit, not just byte 0 bit 0', async () => {
    const payload = await aesEncrypt(message, passphrase);
    const len = fromBase64(payload.ciphertext).length;
    for (const [byteIndex, bitIndex] of [[0, 0], [1, 7], [len - 1, 3], [Math.floor(len / 2), 5]]) {
      const tampered = tamperWithCiphertext(payload, byteIndex, bitIndex);
      expect(tampered.ciphertext).not.toBe(payload.ciphertext);
      expect(await aesVerifyIntegrity(tampered, passphrase)).toBe(false);
    }
  });

  it('clamps an out-of-range tamper position onto the ciphertext instead of missing', async () => {
    const payload = await aesEncrypt(message, passphrase);
    const len = fromBase64(payload.ciphertext).length;
    const past = tamperWithCiphertext(payload, len + 500, 99);
    const last = tamperWithCiphertext(payload, len - 1, 7);
    expect(past.ciphertext).toBe(last.ciphertext);
    expect(await aesVerifyIntegrity(past, passphrase)).toBe(false);
  });
});

/**
 * GHASH — the page recomputes the GCM tag itself rather than narrating it, so
 * the arithmetic has to be right. Anchored on the published GCM test vectors
 * (McGrew & Viega, "The Galois/Counter Mode of Operation", Appendix B; the
 * same cases as NIST SP 800-38D), not on this implementation's own output.
 */
describe('GHASH / GF(2^128)', () => {
  const hex = (s: string): Uint8Array =>
    new Uint8Array((s.match(/../g) ?? []).map((b) => parseInt(b, 16)));

  const KEY_ZERO = hex('00000000000000000000000000000000');
  const IV_ZERO = hex('000000000000000000000000');
  const KEY_3 = hex('feffe9928665731c6d6a8f9467308308');
  const IV_3 = hex('cafebabefacedbaddecaf888');
  const C_3 = hex(
    '42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e' +
      '21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e091473f5985'
  );
  const C_4 = C_3.slice(0, 60);
  const AAD_4 = hex('feedfacedeadbeeffeedfacedeadbeefabaddad2');

  it('multiplying by the field identity is a no-op', () => {
    const one = new Uint8Array(16);
    one[0] = 0x80; // GCM bit order: bit 0 is the MSB of byte 0
    const x = hex('0388dace60b6a392f328c2b971b2fe78');
    expect(bytesToHexGhash(gf128Mul(x, one))).toBe('0388dace60b6a392f328c2b971b2fe78');
    expect(bytesToHexGhash(gf128Mul(one, x))).toBe('0388dace60b6a392f328c2b971b2fe78');
  });

  it('derives the published hash subkey H = E_K(0^128) for both vector keys', async () => {
    expect(bytesToHexGhash(await aesBlockEncrypt(KEY_ZERO, new Uint8Array(16)))).toBe(
      '66e94bd4ef8a2c3b884cfa59ca342b2e'
    );
    expect(bytesToHexGhash(await aesBlockEncrypt(KEY_3, new Uint8Array(16)))).toBe(
      'b83b533708bf535d0aa6e52980d53b78'
    );
  });

  it('reproduces GCM test case 1 (empty ciphertext, tag is the bare mask)', async () => {
    const parts = await computeGcmTag(KEY_ZERO, IV_ZERO, new Uint8Array(0));
    expect(bytesToHexGhash(parts.tag)).toBe('58e2fccefa7e3061367f1d57a4e7455a');
    expect(bytesToHexGhash(parts.mask)).toBe('58e2fccefa7e3061367f1d57a4e7455a');
  });

  it('reproduces GCM test case 2 (one ciphertext block)', async () => {
    const parts = await computeGcmTag(KEY_ZERO, IV_ZERO, hex('0388dace60b6a392f328c2b971b2fe78'));
    expect(bytesToHexGhash(parts.tag)).toBe('ab6e47d42cec13bdf53a67b21257bddf');
    expect(parts.blocks).toBe(1);
  });

  it('reproduces GCM test case 3 (four ciphertext blocks)', async () => {
    const parts = await computeGcmTag(KEY_3, IV_3, C_3);
    expect(bytesToHexGhash(parts.tag)).toBe('4d5c2af327cd64a62cf35abd2ba6fab4');
    expect(parts.blocks).toBe(4);
  });

  it('reproduces GCM test case 4 (partial final block plus AAD)', async () => {
    const parts = await computeGcmTag(KEY_3, IV_3, C_4, AAD_4);
    expect(bytesToHexGhash(parts.tag)).toBe('5bc94fbc3221a5db94fae95ae7121a47');
    // 2 AAD blocks (20 bytes) + 4 ciphertext blocks (60 bytes).
    expect(parts.blocks).toBe(6);
  });

  it('rejects an IV length it does not implement rather than silently misreporting', async () => {
    await expect(computeGcmTag(KEY_ZERO, new Uint8Array(8), new Uint8Array(0))).rejects.toThrow(
      /96-bit IV/
    );
  });

  it('moves the tag by exactly delta·H² when one ciphertext block changes', async () => {
    // For a single-block message, GHASH = ((C·H) ⊕ len)·H, so changing C by
    // delta must move the tag by delta·H·H and by nothing else. This ties
    // gf128Mul and ghash together with an identity taken from the GCM spec,
    // not from what this code happens to print.
    const c = hex('0388dace60b6a392f328c2b971b2fe78');
    const cPrime = new Uint8Array(c);
    cPrime[5] ^= 0x40;

    const h = await aesBlockEncrypt(KEY_ZERO, new Uint8Array(16));
    const delta = new Uint8Array(16);
    for (let i = 0; i < 16; i++) delta[i] = c[i] ^ cPrime[i];

    const a = await computeGcmTag(KEY_ZERO, IV_ZERO, c);
    const b = await computeGcmTag(KEY_ZERO, IV_ZERO, cPrime);
    const moved = new Uint8Array(16);
    for (let i = 0; i < 16; i++) moved[i] = a.tag[i] ^ b.tag[i];

    expect(bytesToHexGhash(moved)).toBe(bytesToHexGhash(gf128Mul(gf128Mul(delta, h), h)));
    expect(bitDifference(a.tag, b.tag)).toBeGreaterThan(0);
  });

  it('recomputes the tag Web Crypto actually sealed with, and loses it after one flipped bit', async () => {
    const payload = await aesEncrypt('The arc bends toward authenticated encryption.', 'passphrase');
    const keyBytes = await deriveKeyBytes('passphrase', fromBase64(payload.salt));
    const sealed = fromBase64(payload.tag);

    const before = await computeGcmTag(keyBytes, fromBase64(payload.iv), fromBase64(payload.ciphertext));
    expect(bytesToHexGhash(before.tag)).toBe(bytesToHexGhash(sealed));
    expect(bitDifference(before.tag, sealed)).toBe(0);

    const tampered = tamperWithCiphertext(payload, 3, 2);
    const after = await computeGcmTag(keyBytes, fromBase64(tampered.iv), fromBase64(tampered.ciphertext));
    expect(bytesToHexGhash(after.tag)).not.toBe(bytesToHexGhash(sealed));
    expect(bitDifference(after.tag, sealed)).toBeGreaterThan(0);
  });

  it('counts differing bits and refuses mismatched lengths', () => {
    expect(bitDifference(hex('00'), hex('ff'))).toBe(8);
    expect(bitDifference(hex('0f0f'), hex('0f0e'))).toBe(1);
    expect(bitDifference(hex('abcd'), hex('abcd'))).toBe(0);
    expect(() => bitDifference(hex('00'), hex('0000'))).toThrow(/length mismatch/);
  });
});
