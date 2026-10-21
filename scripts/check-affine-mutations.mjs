// Mutations run only on a committed, clean source baseline. Each is built, killed,
// restored byte-for-byte, rebuilt and tested green before the next begins.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../demos/dead-sea-cipher'); process.chdir(root);
const config = process.env.PLAYWRIGHT_CONFIG;
const browser = title => ['npx', ['playwright','test','e2e/affine.spec.ts','--project=chromium','--grep',title,'--workers=1','--retries=0',...(config ? ['--config',config] : [])]];
const build = ['npm',['run','build']];
const run = ([cmd,args]) => spawnSync(cmd,args,{cwd:root,encoding:'utf8',env:{...process.env,CI:'1'}});
const pass = (cmd,label) => { const r=run(cmd); if(r.status!==0) throw Error(`${label}\n${r.stdout}\n${r.stderr}`); return r; };
const hash = () => { const h=createHash('sha256'); const walk=d=>{for(const e of readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(d,e.name); if(e.isDirectory())walk(p);else {h.update(p);h.update(readFileSync(p));}}};walk('dist');return h.digest('hex'); };
const cases = [
 ["admissible modulus","src/ciphers/affine.ts","gcd(a, 26) === 1","gcd(a, 13) === 1",['npx',['vitest','run','src/__tests__/affine.test.ts','-t',"admissible multipliers"]]],
 ["inverse multiplier","src/ciphers/affine.ts","y => inv * (y - b)","y => a * (y - b)",['npx',['vitest','run','src/__tests__/affine.test.ts','-t',"all 312 round trips"]]],
 ["inverse offset","src/ciphers/affine.ts","y => inv * (y - b)","y => inv * y - b",['npx',['vitest','run','src/__tests__/affine.test.ts','-t',"all 312 round trips"]]],
 ["Caesar-only ranking","src/analysis/affine-crack.ts","for (const a of validA()) for","for (const a of [1]) for",['npx',['vitest','run','src/__tests__/affine.test.ts','-t',"short and long text rankings"]]],
 ["inadmissible solved key","src/analysis/affine-crack.ts","if (gcd(a, 26) !== 1) return { kind: 'NoAffineKey', a };","if (gcd(a, 26) < 0) return { kind: 'NoAffineKey', a };",['npx',['vitest','run','src/__tests__/affine.test.ts','-t',"NoAffineKey rejects"]]],
 ["calm recovery","src/ui/affine-card.ts","el('verdict').className=recovered?'affine-alarm':'affine-info';","el('verdict').className=recovered?'affine-info':'affine-info';",browser("Affine negative claim")],
 ["missing negative claim","src/ui/affine-card.ts","it is still one fixed letter for one fixed letter","a substitution is used",browser("Affine negative claim")],
 ["broken fixture check","src/ui/affine-card.ts","['admissible',keys.includes(a),'a is admissible']","['admissible',!keys.includes(a),'a is admissible']",browser("Affine negative claim")],
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
