import { describe, it, expect } from 'vitest';
import { atbash, atbashHebrew } from '../ciphers/atbash.ts';
import { caesarEncrypt, caesarDecrypt, caesarBruteForce } from '../ciphers/caesar.ts';
import { vigenereEncrypt, vigenereDecrypt } from '../ciphers/vigenere.ts';
import { generateOTPKey, otpEncrypt, otpDecrypt, otpKeyReuseAttack, textToBytes, bytesToText } from '../ciphers/otp.ts';
import { letterFrequency, indexOfCoincidence, chiSquaredFitness } from '../analysis/frequency.ts';
import { kasiskiExamination } from '../analysis/kasiski.ts';
import { crackCaesar } from '../analysis/caesar-crack.ts';
import { aesEncrypt, aesDecrypt, aesVerifyIntegrity, tamperWithCiphertext } from '../ciphers/aes.ts';

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
});
