/**
 * Frequency analysis tools for classical cryptanalysis.
 * Letter frequency analysis, Index of Coincidence, and chi-squared fitness.
 */

export interface FrequencyResult {
  letter: string;
  count: number;
  percentage: number;
}

// Expected English letter frequencies (percentage)
export const ENGLISH_FREQUENCIES: Record<string, number> = {
  A: 8.167, B: 1.492, C: 2.782, D: 4.253, E: 12.702,
  F: 2.228, G: 2.015, H: 6.094, I: 6.966, J: 0.153,
  K: 0.772, L: 4.025, M: 2.406, N: 6.749, O: 7.507,
  P: 1.929, Q: 0.095, R: 5.987, S: 6.327, T: 9.056,
  U: 2.758, V: 0.978, W: 2.360, X: 0.150, Y: 1.974,
  Z: 0.074,
};

export function letterFrequency(text: string): FrequencyResult[] {
  const counts: Record<string, number> = {};
  let total = 0;

  for (const ch of text.toUpperCase()) {
    if (ch >= 'A' && ch <= 'Z') {
      counts[ch] = (counts[ch] || 0) + 1;
      total++;
    }
  }

  if (total === 0) return [];

  const results: FrequencyResult[] = [];
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const count = counts[letter] || 0;
    results.push({
      letter,
      count,
      percentage: (count / total) * 100,
    });
  }

  results.sort((a, b) => b.percentage - a.percentage);
  return results;
}

export function indexOfCoincidence(text: string): number | null {
  // IC ≈ 0.065 for English, ≈ 0.038 for random
  const counts: number[] = new Array(26).fill(0);
  let total = 0;

  // Sample the 26-letter alphabet of the exhibit. Unicode case conversion can
  // expand a single unrelated character into several ASCII letters.
  for (const ch of text.match(/[A-Za-z]/g) ?? []) {
    counts[ch.toUpperCase().charCodeAt(0) - 65]++;
    total++;
  }

  if (total < 2) return null;

  let sum = 0;
  for (let i = 0; i < 26; i++) {
    sum += counts[i] * (counts[i] - 1);
  }

  return sum / (total * (total - 1));
}

export function chiSquaredFitness(text: string): number {
  // Lower = better fit to English. Returns the chi-squared statistic.
  const freq = letterFrequency(text);
  if (freq.length === 0) return Infinity;

  const total = freq.reduce((sum, f) => sum + f.count, 0);
  if (total === 0) return Infinity;

  let chiSquared = 0;
  for (const f of freq) {
    const expected = (ENGLISH_FREQUENCIES[f.letter] / 100) * total;
    if (expected > 0) {
      chiSquared += ((f.count - expected) ** 2) / expected;
    }
  }

  return chiSquared;
}
