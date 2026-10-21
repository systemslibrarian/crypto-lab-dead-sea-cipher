import { describe, it, expect } from 'vitest';
import { affineEncrypt as enc, affineDecrypt as dec, validA, inverseMod26, collisions, gcd } from '../ciphers/affine';
import { crackAffine, solveFromPairs, confirmPair } from '../analysis/affine-crack';
import { caesarEncrypt } from '../ciphers/caesar';
import { atbash } from '../ciphers/atbash';
import { indexOfCoincidence } from '../analysis/frequency';
import { SCRIPTURE_REFERENCES } from '../content/scripture';
describe('affine arithmetic facts (original examples, not published vectors)',()=>{
 it('admissible multipliers and independently checked inverses',()=>{expect(validA()).toEqual([1,3,5,7,9,11,15,17,19,21,23,25]);expect(validA().length*26).toBe(312);for(const a of validA())expect(a*inverseMod26(a)!%26).toBe(1);});
 it('original known answers preserve case and punctuation',()=>{expect(enc('DEAD SEA SCROLLS',7,3)).toBe('YFDY ZFD ZRSXCCZ');expect(enc('In the beginning',11,20)).toBe('Eh vtm fmiehhehi');});
 it('all 312 round trips and IC permutations',()=>{const p='ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 123 ! é';for(const a of validA())for(let b=0;b<26;b++){expect(dec(enc(p,a,b),a,b)).toBe(p);expect(indexOfCoincidence(enc(p,a,b))).toBe(indexOfCoincidence(p));}});
 it('Atbash and all Caesar shifts are actual special cases',()=>{const p='ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz!? 123';expect(enc(p,25,25)).toBe(atbash(p));for(let b=0;b<26;b++)expect(enc(p,1,b)).toBe(caesarEncrypt(p,b));});
 it('inadmissible a refuses decryption and collisions explain why',()=>{for(let a=1;a<26;a++)expect(collisions(a).length===0).toBe(gcd(a,26)===1);expect(()=>dec('ABC',2,0)).toThrow('Not decryptable');expect(collisions(2)[0]).toEqual([0,13]);expect(new Set(enc('ABCDEFGHIJKLMNOPQRSTUVWXYZ',13,0)).size).toBe(2);});
 it('zero-difference pair needs another pair',()=>expect(solveFromPairs(0,1,0,1)).toEqual({kind:'NotInvertible',diff:0}));
 it('non-invertible difference needs another pair',()=>expect(solveFromPairs(4,1,0,2)).toEqual({kind:'NotInvertible',diff:4}));
 it('NoAffineKey rejects the common inadmissible solved multiplier',()=>{expect(solveFromPairs(3,24,4,0)).toEqual({kind:'NoAffineKey',a:2});expect(solveFromPairs(0,2,1,2)).toEqual({kind:'NoAffineKey',a:0});expect(solveFromPairs(3,24,4,5)).toEqual({a:7,b:3});});
 it('third pair mismatch is not a key recovery',()=>expect(confirmPair({a:7,b:3},0,0)).toBe(false));
 it('no letters refuses ranking',()=>expect(()=>crackAffine('123!?')).toThrow('Nothing to measure'));
 it('short and long text rankings vary with text, not encryption key',()=>{for(const [text,rank] of [[SCRIPTURE_REFERENCES.closing.english,0],['DEAD SEA SCROLLS',1]] as const)for(const [a,b] of [[7,3],[11,20],[25,25]])expect(crackAffine(enc(text,a,b)).findIndex(r=>r.a===a&&r.b===b)).toBe(rank);});
 it('all 26^4 pair tuples agree with exhaustive admissible-key mapping',()=>{
   // Independent brute-force lookup: enumerate every key and x pair once, then query all tuples.
   const possible=new Map<number,Array<{a:number;b:number}>>();
   for(let a=1;a<26;a++)if([1,3,5,7,9,11,15,17,19,21,23,25].includes(a))for(let b=0;b<26;b++)for(let x1=0;x1<26;x1++)for(let x2=0;x2<26;x2++){
     const y1=(a*x1+b)%26,y2=(a*x2+b)%26,idx=((x1*26+y1)*26+x2)*26+y2;
     possible.set(idx,[...(possible.get(idx)??[]),{a,b}]);
   }
   let cases=0;for(let x1=0;x1<26;x1++)for(let y1=0;y1<26;y1++)for(let x2=0;x2<26;x2++)for(let y2=0;y2<26;y2++){
     const r=solveFromPairs(x1,y1,x2,y2),keys=possible.get(((x1*26+y1)*26+x2)*26+y2)??[];
     if(gcd(Math.abs(x1-x2),26)!==1){if(!('kind'in r)||r.kind!=='NotInvertible')throw Error('Ambiguous difference wrongly solved');}
     else if(keys.length){if('kind'in r||keys.length!==1||r.a!==keys[0].a||r.b!==keys[0].b)throw Error('Unique key missed');}
     else if(!('kind'in r)||r.kind!=='NoAffineKey')throw Error('Impossible pair accepted');cases++;
   }expect(cases).toBe(26**4);
 });
});
