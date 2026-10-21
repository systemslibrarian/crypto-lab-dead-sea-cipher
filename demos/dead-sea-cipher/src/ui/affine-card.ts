import { affineEncrypt, affineDecrypt, validA, inverseMod26, collisions, mod26 } from '../ciphers/affine';
import { crackAffine, solveFromPairs, confirmPair } from '../analysis/affine-crack';
import { indexOfCoincidence } from '../analysis/frequency';
import { caesarEncrypt } from '../ciphers/caesar';
import { atbash } from '../ciphers/atbash';
import { SCRIPTURE_REFERENCES } from '../content/scripture';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function buildAffineCard(): string {
  const letters = (id: string, label: string, value: string) => `<label>${label}<input id="affine-${id}" type="text" maxlength="1" value="${value}" autocomplete="off" title="Enter one Latin letter A–Z; case does not matter."></label>`;
  return `<section class="card affine-card" aria-labelledby="affine-title"><h3 id="affine-title">Generalising the shift: the affine cipher</h3>
  <p>Caesar adds a fixed number to every letter. The affine cipher first multiplies by a key number a, then adds b. Multiplication only works as encryption if it can be undone: multiply by 2 and different letters collide.</p>
  <details class="predict-prompt"><summary>Predict: does multiplying add 25 × 26 keys, or fewer?</summary><p>Fewer. Only multipliers coprime to 26 can be undone. The list below is computed from that rule.</p></details>
  <div class="affine-controls"><label>a: multiply<select id="affine-a" title="An inadmissible multiplier is selectable so you can see information being lost.">${Array.from({length:25},(_,i)=>i+1).map(a=>`<option value="${a}" ${a===7?'selected':''}>${a}${validA().includes(a)?'':' (not invertible)'}</option>`).join('')}</select></label><label>b: add<select id="affine-b">${Array.from({length:26},(_,b)=>`<option value="${b}" ${b===3?'selected':''}>${b}</option>`).join('')}</select></label></div>
  <p><button id="affine-caesar" class="action-btn">Caesar (a = 1)</button> <button id="affine-atbash" class="action-btn">Atbash (a = 25, b = 25)</button></p>
  <div class="cipher-io"><div class="io-group"><label for="affine-text">Affine plaintext</label><textarea id="affine-text">${SCRIPTURE_REFERENCES.closing.english}</textarea></div><div class="io-group"><label id="affine-cipher-label">Affine ciphertext</label><div id="affine-cipher" class="output" role="status" aria-live="polite" aria-labelledby="affine-cipher-label"></div></div></div>
  <p class="note">A = 0 … Z = 25. Encrypt y = a·x + b (mod 26); undo with x = a⁻¹(y − b) (mod 26).</p>
  <div id="affine-map" class="affine-map" role="list" aria-label="Computed letter substitutions"></div>
  <div id="affine-checks" role="status" aria-live="polite"></div><p id="affine-count"></p><p id="affine-ic"></p><p id="affine-special" role="status"></p>
  <h4>Try every key</h4><button id="affine-rank" class="action-btn">Try every key</button><p id="affine-notice" role="status" aria-live="polite"></p><div id="affine-ranking" class="affine-ranking" role="region" tabindex="0" aria-label="All affine candidates ranked by English letter frequencies" hidden></div><div id="affine-verdict" role="status" aria-live="polite"></div>
  <h4>Two known letters can determine the key</h4><p>Choose pairs whose plaintext difference is invertible modulo 26. Otherwise add another pair: these two alone cannot determine a unique key by this formula.</p>
  <div class="affine-controls">${letters('x1','First plaintext','D')}${letters('y1','First ciphertext','Y')}${letters('x2','Second plaintext','E')}${letters('y2','Second ciphertext','F')}${letters('x3','Third plaintext (optional)','')}${letters('y3','Third ciphertext (optional)','')}</div><button id="affine-solve" class="action-btn">Solve the pairs</button><div id="affine-solver" role="status" aria-live="polite"></div>
  <p class="note">Teaching cipher only. This card makes no historical-use claim for the affine generalisation.</p></section>`;
}
export function initAffine(): void {
  const el = <T extends HTMLElement=HTMLElement>(id: string) => document.getElementById(`affine-${id}`) as T;
  const value = (id:string) => el<HTMLInputElement>(id).value;
  const put = (id:string,text:string) => {el(id).textContent=text;};
  const snapshot=()=>JSON.stringify([value('a'),value('b'),value('text')]); let previous='';
  function clearVerdict(id:string) {el(id).replaceChildren(); el(id).className=''; delete el(id).dataset.verdict;}
  function update() {
    const next=snapshot();if(next===previous)return; const changed=previous!=='';previous=next;
    const a=Number(value('a')),b=Number(value('b')),text=value('text'),ct=affineEncrypt(text,a,b),inv=inverseMod26(a),keys=validA();
    put('cipher',ct);el('ranking').hidden=true;el('ranking').replaceChildren();clearVerdict('verdict');clearVerdict('solver');
    put('notice',changed?'Key or plaintext changed: previous ranking and solver result retired.':'');put('special','');
    el('checks').replaceChildren();
    if(inv===null){put('checks',`Info — not decryptable: a = ${a} is not invertible mod 26; this key destroys information. ${new Set(Array.from({length:26},(_,x)=>mod26(a*x))).size} distinct outputs. Collisions: ${collisions(a).map(xs=>xs.map(x=>alphabet[x]).join(' = ')).join('; ')}.`);}
    else {for(const [name,ok,label] of [['admissible',keys.includes(a),'a is admissible'],['inverse',mod26(a*inv)===1,`${a} × ${inv} mod 26 = ${mod26(a*inv)}`],['roundtrip',affineDecrypt(ct,a,b)===text,'round trip preserves the plaintext']] as const){const row=document.createElement('p');row.dataset.check=name;row.dataset.verdict=ok?'pass':'fail';row.className=ok?'affine-ok':'affine-alarm';row.textContent=`${ok?'✓':'⚠'} ${label}`;el('checks').append(row);}}
    put('count',`${keys.length} admissible multipliers: ${keys.join(', ')}. ${keys.length} × 26 = ${keys.length*26} keys, one of which leaves the text unchanged. This counts the zero shift; the historical Caesar note below excludes it.`);
    put('ic',`Plaintext IC ${indexOfCoincidence(text).toFixed(6)}; ciphertext IC ${indexOfCoincidence(ct).toFixed(6)}.${inv===null?' A collision is not a permutation, so IC need not be preserved.':' The same frequency fingerprint survives this letter permutation.'}`);
    el('map').replaceChildren();for(let x=0;x<26;x++){const cell=document.createElement('span');cell.setAttribute('role','listitem');cell.textContent=`${alphabet[x]} (${x}) → ${alphabet[mod26(a*x+b)]} (${mod26(a*x+b)})`;el('map').append(cell);}
  }
  for(const id of ['a','b','text']){el(id).addEventListener('input',update);el(id).addEventListener('change',update);}update();
  el('caesar').addEventListener('click',()=>{el<HTMLSelectElement>('a').value='1';update();put('special',`✓ Matches this lab’s Caesar: ${affineEncrypt(value('text'),1,Number(value('b')))===caesarEncrypt(value('text'),Number(value('b')))}`);});
  el('atbash').addEventListener('click',()=>{el<HTMLSelectElement>('a').value='25';el<HTMLSelectElement>('b').value='25';update();put('special',`✓ Matches this lab’s Latin Atbash: ${affineEncrypt(value('text'),25,25)===atbash(value('text'))}`);});
  el('rank').addEventListener('click',()=>{
    clearVerdict('verdict');el('ranking').replaceChildren();el('ranking').hidden=true;
    try {
      if(inverseMod26(Number(value('a')))===null)throw Error('Not decryptable: choose an admissible multiplier before ranking affine keys.');
      const rows=crackAffine(el('cipher').textContent??''), count=(value('text').match(/[a-z]/gi)??[]).length;
      for(const [i,row] of rows.entries()){const p=document.createElement('p');p.className=`affine-candidate${i<3?' affine-top':''}`;p.dataset.a=String(row.a);p.dataset.b=String(row.b);p.textContent=`${i+1}. a=${row.a}, b=${row.b} · χ²=${row.score.toFixed(3)} · ${row.plaintext}`;el('ranking').append(p);}el('ranking').hidden=false;
      put('notice',`${count} letters; ${rows.length} candidates. ${count<40?'Short texts mislead the statistics. The top row is most likely, not a proven key.':'Frequency ranking is a statistical guess; compare the candidate with the actual message.'}`);
      const top=rows[0],recovered=top.a===Number(value('a'))&&top.b===Number(value('b'));
      el('verdict').className=recovered?'affine-alarm':'affine-info';el('verdict').dataset.verdict=recovered?'recovered':'candidate';
      put('verdict',`${recovered?'⚠ VALID KEY — AND RECOVERED BY FREQUENCY':'Info — MOST LIKELY CANDIDATE'}: a = ${top.a}, b = ${top.b}. Multiplying first raises the number of keys to 312, but does not make this cipher secure: it is still one fixed letter for one fixed letter, so the frequency attack that breaks Caesar also applies here.`);
    }catch(e){put('notice',(e as Error).message);}
  });
  const pairIds=['x1','y1','x2','y2','x3','y3'];let pairSnapshot=pairIds.map(value).join('|');
  for(const id of pairIds)el(id).addEventListener('input',()=>{const next=pairIds.map(value).join('|');if(next!==pairSnapshot){pairSnapshot=next;clearVerdict('solver');put('solver','Pairs changed: previous solver result retired.');}});
  el('solve').addEventListener('click',()=>{
    clearVerdict('solver');try{const letter=(id:string)=>{const v=value(id);if(!/^[a-z]$/i.test(v))throw Error('Each pair needs one Latin letter.');return v.toUpperCase().charCodeAt(0)-65;};
      const r=solveFromPairs(letter('x1'),letter('y1'),letter('x2'),letter('y2'));
      if('kind'in r){el('solver').className='affine-info';el('solver').dataset.verdict=r.kind;put('solver',r.kind==='NotInvertible'?`Info — difference ${r.diff} has no inverse mod 26; add another pair.`:`Info — no affine key maps ${value('x1')}→${value('y1')} and ${value('x2')}→${value('y2')}; the solved multiplier ${r.a} is inadmissible.`);return;}
      const third=value('x3')||value('y3');const fits=!third||confirmPair(r,letter('x3'),letter('y3'));
      el('solver').className=fits?'affine-alarm':'affine-info';el('solver').dataset.verdict=fits?'recovered':'third-mismatch';put('solver',fits?`⚠ key found: a = ${r.a}, b = ${r.b}.${third?' This key also explains your third letter.':''}`:`Info — this key does not explain your third letter; no single key fits all three pairs.`);
    }catch(e){el('solver').className='affine-info';el('solver').dataset.verdict='invalid';put('solver',(e as Error).message);}
  });
}
