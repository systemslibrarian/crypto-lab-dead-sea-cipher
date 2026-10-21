import { affineDecrypt, mod26, validA } from '../ciphers/affine';
import { chiSquaredFitness } from './frequency';

export interface AffineKey {
  a: number;
  b: number;
}

export interface NoAffineKey {
  kind: 'NoAffineKey';
}

export interface SeveralKeys {
  kind: 'SeveralKeys';
  count: number;
}

export type PairResult = AffineKey | NoAffineKey | SeveralKeys;

export function crackAffine(ciphertext: string) {
  if (!/[a-z]/i.test(ciphertext)) {
    throw Error('Nothing to measure: enter some Latin letters.');
  }
  const rows: (AffineKey & { plaintext: string; score: number })[] = [];
  for (const a of validA()) {
    for (let b = 0; b < 26; b++) {
      const plaintext = affineDecrypt(ciphertext, a, b);
      rows.push({ a, b, plaintext, score: chiSquaredFitness(plaintext) });
    }
  }
  return rows.sort((x, y) => x.score - y.score || x.a - y.a || x.b - y.b);
}

// The admissible set is fixed for this 26-letter alphabet.
const multipliers = validA();

/** Keep exactly the admissible keys satisfying every supplied letter pair. */
export function solveFromPairs(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3?: number,
  y3?: number,
): PairResult {
  const pairs = [
    [x1, y1],
    [x2, y2],
  ];
  if (x3 !== undefined || y3 !== undefined) {
    pairs.push([x3!, y3!]);
  }
  if (!pairs.flat().every((x) => Number.isInteger(x) && x >= 0 && x < 26)) {
    throw Error('Each pair needs one Latin letter.');
  }

  const matches: AffineKey[] = [];
  for (const a of multipliers) {
    for (let b = 0; b < 26; b++) {
      // Inputs and keys are nonnegative, so % is already the canonical residue.
      if ((a * x1 + b) % 26 !== y1 || (a * x2 + b) % 26 !== y2) continue;
      if (pairs.length === 3 && (a * x3! + b) % 26 !== y3) continue;
      matches.push({ a, b });
    }
  }
  if (matches.length === 0) {
    return { kind: 'NoAffineKey' };
  }
  if (matches.length > 1) {
    return { kind: 'SeveralKeys', count: matches.length };
  }
  return matches[0];
}

export function confirmPair(key: AffineKey, x: number, y: number): boolean {
  return mod26(key.a * x + key.b) === y;
}
