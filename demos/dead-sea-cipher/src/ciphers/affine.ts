/** Arithmetic teaching cipher; Latin letters only. No security for real data. */
export const mod26 = (x: number): number => ((x % 26) + 26) % 26;
export function gcd(a: number, b: number): number { while (b) [a, b] = [b, a % b]; return Math.abs(a); }
export function validA(): number[] { return Array.from({ length: 25 }, (_, i) => i + 1).filter(a => gcd(a, 26) === 1); }
export function inverseMod26(a: number): number | null {
  for (let i = 1; i < 26; i++) if (mod26(a * i) === 1) return i;
  return null;
}
function mapLetters(text: string, f: (x: number) => number): string {
  return text.replace(/[a-z]/gi, ch => {
    const base = ch >= 'a' ? 97 : 65;
    return String.fromCharCode(base + mod26(f(ch.charCodeAt(0) - base)));
  });
}
function parameters(a: number, b: number): void { if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) throw Error('Keys must be safe integers.'); }
export function affineEncrypt(text: string, a: number, b: number): string {
  parameters(a, b); return mapLetters(text, x => a * x + b);
}
export function affineDecrypt(text: string, a: number, b: number): string {
  parameters(a, b); const inv = inverseMod26(a);
  if (inv === null) throw Error(`Not decryptable: gcd(${a}, 26) = ${gcd(a, 26)}; this key destroys information.`);
  return mapLetters(text, y => inv * (y - b));
}
export function collisions(a: number): number[][] {
  const groups = new Map<number, number[]>();
  for (let x = 0; x < 26; x++) { const y = mod26(a * x); groups.set(y, [...(groups.get(y) ?? []), x]); }
  return [...groups.values()].filter(xs => xs.length > 1);
}
// [extension] point: affine substitution modulo another alphabet size needs its own alphabet and historical source.
