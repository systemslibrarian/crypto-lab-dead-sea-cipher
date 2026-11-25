/**
 * Atbash cipher — a Hebrew substitution cipher attested in Jeremiah.
 * Used in the Hebrew Bible (Jeremiah 25:26, 51:1, 51:41).
 * Each letter maps to its mirror in the alphabet: A↔Z, B↔Y, etc.
 */

const LATIN_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LATIN_LOWER = 'abcdefghijklmnopqrstuvwxyz';

// Hebrew transliterated alphabet (22 letters in traditional order):
// Aleph, Bet, Gimel, Dalet, He, Vav, Zayin, Chet, Tet, Yod, Kaf,
// Lamed, Mem, Nun, Samekh, Ayin, Pe, Tsade, Qof, Resh, Shin, Tav
const HEBREW_TRANSLITERATED = [
  'A', 'B', 'G', 'D', 'H', 'V', 'Z', 'Ch', 'T', 'Y', 'K',
  'L', 'M', 'N', 'S', 'O', 'P', 'Ts', 'Q', 'R', 'Sh', 'Tv'
];

// Reversed for Atbash mapping:
// A↔Tv, B↔Sh, G↔R, D↔Q, H↔Ts, V↔P, Z↔O, Ch↔S, T↔N, Y↔M, K↔L
const HEBREW_REVERSED = [...HEBREW_TRANSLITERATED].reverse();

// Hebrew script alphabet (22 letters, base forms only)
const HEBREW_SCRIPT = 'אבגדהוזחטיכלמנסעפצקרשת';
const HEBREW_SCRIPT_REVERSED = HEBREW_SCRIPT.split('').reverse().join('');

// Final forms (sofit) map to their base letter for Atbash purposes
const FINAL_TO_BASE: Record<string, string> = {
  'ך': 'כ', // final Kaf
  'ם': 'מ', // final Mem
  'ן': 'נ', // final Nun
  'ף': 'פ', // final Pe
  'ץ': 'צ', // final Tsadi
};
const BASE_TO_FINAL: Record<string, string> = {
  'כ': 'ך',
  'מ': 'ם',
  'נ': 'ן',
  'פ': 'ף',
  'צ': 'ץ',
};

export function atbash(text: string, alphabet: 'latin' | 'hebrew-transliterated' = 'latin'): string {
  if (alphabet === 'latin') {
    return atbashLatin(text);
  }
  return atbashHebrewTransliterated(text);
}

function atbashLatin(text: string): string {
  let result = '';
  for (const ch of text) {
    const upperIdx = LATIN_UPPER.indexOf(ch);
    if (upperIdx !== -1) {
      result += LATIN_UPPER[25 - upperIdx];
      continue;
    }
    const lowerIdx = LATIN_LOWER.indexOf(ch);
    if (lowerIdx !== -1) {
      result += LATIN_LOWER[25 - lowerIdx];
      continue;
    }
    result += ch;
  }
  return result;
}

function atbashHebrewTransliterated(text: string): string {
  // Build a mapping from each transliterated token to its Atbash counterpart
  const mapping = new Map<string, string>();
  for (let i = 0; i < HEBREW_TRANSLITERATED.length; i++) {
    mapping.set(HEBREW_TRANSLITERATED[i], HEBREW_REVERSED[i]);
    mapping.set(HEBREW_TRANSLITERATED[i].toUpperCase(), HEBREW_REVERSED[i]);
  }

  let result = '';
  let i = 0;
  while (i < text.length) {
    let matched = false;
    // Try longest tokens first (2 chars like Sh, Ch, Ts, Tv, Qo)
    for (let len = 2; len >= 1; len--) {
      const token = text.substring(i, i + len);
      if (mapping.has(token)) {
        result += mapping.get(token)!;
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += text[i];
      i++;
    }
  }
  return result;
}

export function atbashHebrew(text: string): string {
  const chars = [...text];
  let result = '';
  for (let i = 0; i < chars.length; i++) {
    let ch = chars[i];
    // Normalize final forms to base for lookup
    if (FINAL_TO_BASE[ch]) {
      ch = FINAL_TO_BASE[ch];
    }
    const idx = HEBREW_SCRIPT.indexOf(ch);
    if (idx !== -1) {
      let mapped = HEBREW_SCRIPT_REVERSED[idx];
      // Apply final form if this is the last Hebrew letter before a non-Hebrew char or end
      let next = i + 1;
      while (next < chars.length && /\p{Mark}/u.test(chars[next])) next++;
      const following = chars[next];
      const isLast = !following || !HEBREW_SCRIPT.includes(FINAL_TO_BASE[following] ?? following);
      if (isLast && BASE_TO_FINAL[mapped]) {
        mapped = BASE_TO_FINAL[mapped];
      }
      result += mapped;
    } else {
      result += chars[i];
    }
  }
  return result;
}

export { HEBREW_TRANSLITERATED, HEBREW_REVERSED, HEBREW_SCRIPT, HEBREW_SCRIPT_REVERSED };
