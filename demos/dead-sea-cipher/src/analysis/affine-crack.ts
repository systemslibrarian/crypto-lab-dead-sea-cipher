import { affineDecrypt, mod26, inverseMod26, validA, gcd } from '../ciphers/affine';
import { chiSquaredFitness } from './frequency';
export interface AffineKey { a: number; b: number }
export type PairResult = AffineKey | { kind: 'NotInvertible'; diff: number } | { kind: 'NoAffineKey'; a: number };
export function crackAffine(ciphertext: string) {
  if (!/[a-z]/i.test(ciphertext)) throw Error('Nothing to measure: enter some Latin letters.');
  const rows: (AffineKey & { plaintext: string; score: number })[] = [];
  for (const a of validA()) for (let b = 0; b < 26; b++) {
    const plaintext = affineDecrypt(ciphertext, a, b);
    rows.push({ a, b, plaintext, score: chiSquaredFitness(plaintext) });
  }
  return rows.sort((x, y) => x.score - y.score || x.a - y.a || x.b - y.b);
}
export function solveFromPairs(x1: number, y1: number, x2: number, y2: number): PairResult {
  if (![x1,y1,x2,y2].every(x => Number.isInteger(x) && x >= 0 && x < 26)) throw Error('Each pair needs one Latin letter.');
  const diff = mod26(x1 - x2), inv = inverseMod26(diff);
  if (inv === null) return { kind: 'NotInvertible', diff };
  const a = mod26((y1 - y2) * inv);
  if (gcd(a, 26) !== 1) return { kind: 'NoAffineKey', a };
  return { a, b: mod26(y1 - a * x1) };
}
export function confirmPair(key: AffineKey, x: number, y: number): boolean { return mod26(key.a * x + key.b) === y; }
