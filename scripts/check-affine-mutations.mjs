// Mutations run only on a committed, clean source baseline. Each is built, killed,
// restored byte-for-byte, rebuilt and tested green before the next begins.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../demos/dead-sea-cipher'); process.chdir(root);
const config = process.env.PLAYWRIGHT_CONFIG;
const browser = title => ['npx', ['playwright','test','e2e/claims.spec.ts','--project=chromium','--grep',title,'--workers=1','--retries=0',...(config ? ['--config',config] : [])]];
const build = ['npm',['run','build']];
const run = ([cmd,args]) => spawnSync(cmd,args,{cwd:root,encoding:'utf8',env:{...process.env,CI:'1'}});
const pass = (cmd,label) => { const r=run(cmd); if(r.status!==0) throw Error(`${label}\n${r.stdout}\n${r.stderr}`); return r; };
const hash = () => { const h=createHash('sha256'); const walk=d=>{for(const e of readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(d,e.name); if(e.isDirectory())walk(p);else {h.update(p);h.update(readFileSync(p));}}};walk('dist');return h.digest('hex'); };
const cases = [
  [
    "admissible modulus",
    "src/ciphers/affine.ts",
    "gcd(a, 26) === 1",
    "gcd(a, 13) === 1",
    ['npx', ['vitest', 'run', 'src/__tests__/affine.test.ts', '-t', 'admissible multipliers']],
  ],
  [
    "inverse multiplier",
    "src/ciphers/affine.ts",
    "y => inv * (y - b)",
    "y => a * (y - b)",
    ['npx', ['vitest', 'run', 'src/__tests__/affine.test.ts', '-t', 'all 312 round trips']],
  ],
  [
    "inverse offset",
    "src/ciphers/affine.ts",
    "y => inv * (y - b)",
    "y => inv * y - b",
    ['npx', ['vitest', 'run', 'src/__tests__/affine.test.ts', '-t', 'all 312 round trips']],
  ],
  [
    "Caesar-only ranking",
    "src/analysis/affine-crack.ts",
    "for (const a of validA()) {",
    "for (const a of [1]) {",
    browser('Affine full ranking counts every independently admissible key'),
  ],
  [
    "inadmissible solved key",
    "src/analysis/affine-crack.ts",
    "const multipliers = validA();",
    "const multipliers = Array.from({ length: 26 }, (_, a) => a);",
    browser('Affine NoAffineKey for D→Y/E→A names no key'),
  ],
  [
    "calm recovery",
    "src/ui/affine-card.ts",
    "      } else if (matches) {\n        el('verdict').className = 'affine-alarm';\n        el('verdict').dataset.verdict = 'recovered';",
    "      } else if (matches) {\n        el('verdict').className = 'affine-info';\n        el('verdict').dataset.verdict = 'candidate';",
    browser('Affine ranking recovery is an alarm matching the displayed key'),
  ],
  [
    "missing negative claim",
    "src/ui/affine-card.ts",
    "const negativeClaim = `Multiplying first raises the number of keys to ${validA().length * 26}, but does not make this cipher secure: it is still one fixed letter for one fixed letter, so the frequency attack that breaks Caesar also applies here.`;",
    "const negativeClaim = '';",
    browser('Affine negative claim: valid checks and frequency recovery together'),
  ],
  [
    "broken fixture check",
    "src/ciphers/affine.ts",
    "Array.from({ length: 25 }, (_, i) => i + 1)",
    "Array.from({ length: 6 }, (_, i) => i + 1)",
    browser('Affine negative claim: valid checks and frequency recovery together'),
  ],
  [
    "solver displays b plus one",
    "src/ui/affine-card.ts",
    "⚠ key found: a = ${r.a}, b = ${r.b}.",
    "⚠ key found: a = ${r.a}, b = ${r.b + 1}.",
    browser('Affine solver recovery satisfies every displayed pair'),
  ],
  [
    "pair-change retirement disabled",
    "src/ui/affine-card.ts",
    "if (next !== pairSnapshot) {",
    "if (next === pairSnapshot) {",
    browser('Affine pair change retires the solver verdict and says so'),
  ],
  [
    "short-text guard removed",
    "src/ui/affine-card.ts",
    "      if (matches && shortText) {\n        el('verdict').className = 'affine-alarm';\n        el('verdict').dataset.verdict = 'most-likely';\n        verdict = `⚠ MOST LIKELY KEY: a = ${top.a}, b = ${top.b} — the top candidate matches the key in use, but ${count} letters is too few to call it found`;\n      } else if (matches) {\n",
    "      if (matches) {\n",
    browser('Affine short LOVE ONE ANOTHER match is most likely, never recovered'),
  ],
  [
    "third-pair filter skipped",
    "src/analysis/affine-crack.ts",
    "      if (pairs.length === 3 && (a * x3! + b) % 26 !== y3) continue;\n",
    "",
    browser('Affine third-pair mismatch reports no key fitting all three'),
  ],
  [
    "inadmissible ranking guard removed",
    "src/ui/affine-card.ts",
    "      if (inverseMod26(Number(value('a'))) === null) {\n        throw Error('Not decryptable: choose an admissible multiplier before ranking affine keys.');\n      }\n",
    "",
    browser('Affine inadmissible multiplier refuses decryption and ranking'),
  ],
  [
    "SeveralKeys reported as first key",
    "src/analysis/affine-crack.ts",
    "return { kind: 'SeveralKeys', count: matches.length };",
    "return matches[0];",
    browser('Affine repeated D→Y pairs report SeveralKeys with twelve matches'),
  ],
];
const dirty=spawnSync('git',['diff','--exit-code','--',...new Set(cases.map(x=>x[1]))],{encoding:'utf8'});
if(dirty.status!==0)throw Error('Commit the source baseline before mutation checks.');
pass(build,'baseline build');const baseline=hash();const evidence=[];
mkdirSync('mutation-logs',{recursive:true});
for(const [name,file,before,after,command] of cases){
 pass(command,`${name}: baseline test`);
 const original=readFileSync(file,'utf8');if(original.split(before).length!==2)throw Error(`${name}: expected one mutation site`);
 let mutant;
 try{
  writeFileSync(file,original.replace(before,after));
  const diff=spawnSync('git',['diff','--',file],{encoding:'utf8'}).stdout;if(!diff.trim())throw Error(`${name}: empty diff`);
  pass(build,`${name}: mutant build`); mutant=hash();if(mutant===baseline)throw Error(`${name}: bundle did not move`);
  const r=run(command);writeFileSync(`mutation-logs/${name.replaceAll(' ','-')}.log`,r.stdout+r.stderr);
  if(r.status===0 || !/expect\(|AssertionError|Error: expect/.test(r.stdout+r.stderr))throw Error(`${name}: no assertion kill\n${r.stdout}\n${r.stderr}`);
  evidence.push({name,sourceDiff:diff,baseline,mutant,namedTest:command[1].includes('--grep') ? command[1][command[1].indexOf('--grep')+1] : command[1].at(-1),assertionFailure:true,retries:0});
 }finally{writeFileSync(file,original);pass(build,`${name}: restore build`);if(hash()!==baseline)throw Error(`${name}: restored hash differs`);pass(command,`${name}: restored test`);}
 evidence.at(-1).restoredGreen=true;console.log(`${name}: killed; exact artifact restored; owning test green`);
}
writeFileSync('../../mutation-evidence-affine.json',JSON.stringify(evidence,null,2)+'\n');
