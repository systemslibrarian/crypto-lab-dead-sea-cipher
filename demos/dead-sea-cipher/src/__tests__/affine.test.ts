import { describe, it, expect } from 'vitest';
import {
  affineEncrypt as enc,
  affineDecrypt as dec,
  validA,
  inverseMod26,
  collisions,
  gcd,
} from '../ciphers/affine';
import {
  crackAffine,
  solveFromPairs,
  confirmPair,
  type PairResult,
} from '../analysis/affine-crack';
import { caesarEncrypt } from '../ciphers/caesar';
import { atbash } from '../ciphers/atbash';
import { indexOfCoincidence } from '../analysis/frequency';
import { SCRIPTURE_REFERENCES } from '../content/scripture';

type Pair = [number, number];

// This oracle imports no production admissibility, inverse or mapping arithmetic.
function ownGcd(a: number, b: number): number {
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

const oracleKeys: { a: number; b: number; outputs: number[] }[] = [];
for (let a = 1; a < 26; a++) {
  if (ownGcd(a, 26) !== 1) continue;
  for (let b = 0; b < 26; b++) {
    oracleKeys.push({
      a,
      b,
      outputs: Array.from({ length: 26 }, (_, x) => (a * x + b) % 26),
    });
  }
}

// Enumerate the complete key space once per pair of plaintext coordinates.
// Each bucket is the independent brute-force answer, reused across y-tuples.
const pairBuckets = new Map<number, Map<number, { a: number; b: number; outputs: number[] }[]>>();
function bruteForce(pairs: Pair[]) {
  const [[x1, y1], [x2, y2]] = pairs;
  const coordinate = x1 * 26 + x2;
  let buckets = pairBuckets.get(coordinate);
  if (!buckets) {
    buckets = new Map();
    for (const key of oracleKeys) {
      const output = key.outputs[x1] * 26 + key.outputs[x2];
      const bucket = buckets.get(output) ?? [];
      bucket.push(key);
      buckets.set(output, bucket);
    }
    pairBuckets.set(coordinate, buckets);
  }
  const candidates = buckets.get(y1 * 26 + y2) ?? [];
  return candidates.filter(key => pairs.every(([x, y]) => key.outputs[x] === y));
}

function checkAgainstBruteForce(pairs: Pair[], result: PairResult) {
  const keys = bruteForce(pairs);
  if (keys.length === 1) {
    if ('kind' in result || result.a !== keys[0].a || result.b !== keys[0].b) {
      throw Error(`Unique key missed for ${JSON.stringify(pairs)}: ${JSON.stringify(result)}`);
    }
    return 'one';
  }
  if (keys.length === 0) {
    if (!('kind' in result) || result.kind !== 'NoAffineKey') {
      throw Error(`Impossible pairs accepted: ${JSON.stringify(pairs)}`);
    }
    return 'none';
  }
  if (!('kind' in result) || result.kind !== 'SeveralKeys' || result.count !== keys.length) {
    throw Error(`Ambiguous pairs wrongly solved: ${JSON.stringify(pairs)}`);
  }
  for (const [x1] of pairs) {
    for (const [x2] of pairs) {
      if (Math.abs(x1 - x2) !== 0 && Math.abs(x1 - x2) !== 13) {
        throw Error(`Unexpected ambiguity: ${JSON.stringify(pairs)}`);
      }
    }
  }
  return 'several';
}

describe('affine arithmetic facts (original examples, not published vectors)', () => {
  it('admissible multipliers and independently checked inverses', () => {
    expect(validA()).toEqual([1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25]);
    expect(validA().length * 26).toBe(312);
    for (const a of validA()) expect((a * inverseMod26(a)!) % 26).toBe(1);
  });

  it('original known answers preserve case and punctuation', () => {
    expect(enc('DEAD SEA SCROLLS', 7, 3)).toBe('YFDY ZFD ZRSXCCZ');
    expect(enc('In the beginning', 11, 20)).toBe('Eh vtm fmiehhehi');
  });

  it('all 312 round trips and IC permutations', () => {
    const plaintext = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 123 ! é';
    for (const a of validA()) {
      for (let b = 0; b < 26; b++) {
        expect(dec(enc(plaintext, a, b), a, b)).toBe(plaintext);
        expect(indexOfCoincidence(enc(plaintext, a, b))).toBe(indexOfCoincidence(plaintext));
      }
    }
  });

  it('Atbash and all Caesar shifts are actual special cases', () => {
    const plaintext = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz!? 123';
    expect(enc(plaintext, 25, 25)).toBe(atbash(plaintext));
    for (let b = 0; b < 26; b++) {
      expect(enc(plaintext, 1, b)).toBe(caesarEncrypt(plaintext, b));
    }
  });

  it('inadmissible a refuses decryption and collisions explain why', () => {
    for (let a = 1; a < 26; a++) {
      expect(collisions(a).length === 0).toBe(gcd(a, 26) === 1);
    }
    expect(() => dec('ABC', 2, 0)).toThrow('Not decryptable');
    expect(collisions(2)[0]).toEqual([0, 13]);
    expect(new Set(enc('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 2, 0)).size).toBe(13);
    expect(new Set(enc('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 13, 0)).size).toBe(2);
  });

  it('zero-difference D→Y/D→Y leaves twelve keys', () => {
    expect(solveFromPairs(3, 24, 3, 24)).toEqual({ kind: 'SeveralKeys', count: 12 });
  });

  it('difference thirteen A→D/N→Q leaves twelve keys', () => {
    expect(solveFromPairs(0, 3, 13, 16)).toEqual({ kind: 'SeveralKeys', count: 12 });
  });

  it('even nonzero difference A→D/E→F determines the odd multiplier', () => {
    expect(solveFromPairs(0, 3, 4, 5)).toEqual({ a: 7, b: 3 });
  });

  it('inconsistent even-difference E→B/A→C has no affine key', () => {
    expect(solveFromPairs(4, 1, 0, 2)).toEqual({ kind: 'NoAffineKey' });
  });

  it('NoAffineKey rejects the common inadmissible solved multiplier', () => {
    expect(solveFromPairs(3, 24, 4, 0)).toEqual({ kind: 'NoAffineKey' });
    expect(solveFromPairs(0, 2, 1, 2)).toEqual({ kind: 'NoAffineKey' });
    expect(solveFromPairs(3, 24, 4, 5)).toEqual({ a: 7, b: 3 });
  });

  it('third pair mismatch is not a key recovery', () => {
    expect(confirmPair({ a: 7, b: 3 }, 0, 0)).toBe(false);
    expect(solveFromPairs(3, 24, 4, 5, 0, 0)).toEqual({ kind: 'NoAffineKey' });
  });

  it('a third pair can confirm or disambiguate the key', () => {
    expect(solveFromPairs(3, 24, 4, 5, 0, 3)).toEqual({ a: 7, b: 3 });
    expect(solveFromPairs(0, 3, 13, 16, 4, 5)).toEqual({ a: 7, b: 3 });
  });

  it('invalid pair coordinates and half a third pair are refused', () => {
    for (const invalid of [-1, 26, 0.5, NaN]) {
      expect(() => solveFromPairs(invalid, 3, 4, 5)).toThrow('Each pair needs');
    }
    expect(() => solveFromPairs(3, 24, 4, 5, 0)).toThrow('Each pair needs');
    expect(() => solveFromPairs(3, 24, 4, 5, undefined, 3)).toThrow('Each pair needs');
  });

  it('no letters refuses ranking', () => {
    expect(() => crackAffine('123!?')).toThrow('Nothing to measure');
  });

  it('short and long text rankings vary with text, not encryption key', () => {
    for (const [text, rank] of [
      [SCRIPTURE_REFERENCES.closing.english, 0],
      ['DEAD SEA SCROLLS', 1],
      ['LOVE ONE ANOTHER', 0],
    ] as const) {
      for (const [a, b] of [
        [7, 3],
        [11, 20],
        [25, 25],
      ]) {
        expect(crackAffine(enc(text, a, b)).findIndex((row) => row.a === a && row.b === b)).toBe(
          rank,
        );
      }
    }
  });

  it('all 26^4 pair tuples and category totals agree with independent brute force', () => {
    const counts = { one: 0, none: 0, several: 0 };
    for (let x1 = 0; x1 < 26; x1++) {
      for (let y1 = 0; y1 < 26; y1++) {
        for (let x2 = 0; x2 < 26; x2++) {
          for (let y2 = 0; y2 < 26; y2++) {
            const result = solveFromPairs(x1, y1, x2, y2);
            counts[
              checkAgainstBruteForce(
                [
                  [x1, y1],
                  [x2, y2],
                ],
                result,
              )
            ]++;
          }
        }
      }
    }
    expect(counts).toEqual({ one: 194_688, none: 260_936, several: 1_352 });
    expect(counts.one + counts.none + counts.several).toBe(26 ** 4);
  });

  it('2000 seeded three-pair tuples agree with the same independent brute force', () => {
    let seed = 0xaff1ce;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed >>> 16;
    };
    const counts = { one: 0, none: 0, several: 0 };
    for (let sample = 0; sample < 2000; sample++) {
      const key = oracleKeys[next() % oracleKeys.length];
      const pairs: Pair[] = Array.from({ length: 3 }, () => {
        const x = next() % 26;
        // Include coherent and unconstrained tuples, not only key-generated pairs.
        return [x, sample % 2 === 0 ? key.outputs[x] : next() % 26];
      });
      if (sample % 10 === 0) pairs[1] = [...pairs[0]];
      if (sample % 20 === 0) pairs[2] = [...pairs[0]];
      const [[x1, y1], [x2, y2], [x3, y3]] = pairs;
      counts[checkAgainstBruteForce(pairs, solveFromPairs(x1, y1, x2, y2, x3, y3))]++;
    }
    expect(counts.one).toBeGreaterThan(0);
    expect(counts.none).toBeGreaterThan(0);
    expect(counts.several).toBeGreaterThan(0);
    expect(counts.one + counts.none + counts.several).toBe(2000);
  });
});
