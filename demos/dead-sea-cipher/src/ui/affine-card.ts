import {
  affineEncrypt,
  affineDecrypt,
  validA,
  inverseMod26,
  collisions,
  mod26,
} from '../ciphers/affine';
import { crackAffine, solveFromPairs, type AffineKey } from '../analysis/affine-crack';
import { indexOfCoincidence } from '../analysis/frequency';
import { caesarEncrypt } from '../ciphers/caesar';
import { atbash } from '../ciphers/atbash';
import { SCRIPTURE_REFERENCES } from '../content/scripture';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function buildAffineCard(): string {
  const letters = (id: string, label: string, value: string) => `
    <label>${label}
      <input id="affine-${id}" type="text" maxlength="1" value="${value}"
        autocomplete="off" title="Enter one Latin letter A–Z; case does not matter.">
    </label>`;
  const aOptions = Array.from({ length: 25 }, (_, i) => i + 1)
    .map(
      (a) =>
        `<option value="${a}" ${a === 7 ? 'selected' : ''}>${a}${
          validA().includes(a) ? '' : ' (not invertible)'
        }</option>`,
    )
    .join('');
  const bOptions = Array.from(
    { length: 26 },
    (_, b) => `<option value="${b}" ${b === 3 ? 'selected' : ''}>${b}</option>`,
  ).join('');

  return `
    <section class="card affine-card" aria-labelledby="affine-title">
      <h3 id="affine-title">Generalising the shift: the affine cipher</h3>
      <p>Caesar adds a fixed number to every letter. The affine cipher first multiplies by a key number a, then adds b. Multiplication only works as encryption if it can be undone: multiply by 2 and different letters collide.</p>
      <details class="predict-prompt">
        <summary>Predict: does multiplying add 25 × 26 keys, or fewer?</summary>
        <p>Fewer. Only multipliers coprime to 26 can be undone. The list below is computed from that rule.</p>
      </details>
      <div class="affine-controls">
        <label>a: multiply
          <select id="affine-a" title="An inadmissible multiplier is selectable so you can see information being lost.">${aOptions}</select>
        </label>
        <label>b: add<select id="affine-b">${bOptions}</select></label>
      </div>
      <p>
        <button id="affine-caesar" class="action-btn">Caesar (a = 1)</button>
        <button id="affine-atbash" class="action-btn">Atbash (a = 25, b = 25)</button>
      </p>
      <div class="cipher-io">
        <div class="io-group">
          <label for="affine-text">Affine plaintext</label>
          <textarea id="affine-text">${SCRIPTURE_REFERENCES.closing.english}</textarea>
        </div>
        <div class="io-group">
          <label id="affine-cipher-label">Affine ciphertext</label>
          <div id="affine-cipher" class="output" role="status" aria-live="polite" aria-labelledby="affine-cipher-label"></div>
        </div>
      </div>
      <p class="note">A = 0 … Z = 25. Encrypt y = a·x + b (mod 26); undo with x = a⁻¹(y − b) (mod 26).</p>
      <div id="affine-map" class="affine-map" role="list" aria-label="Computed letter substitutions"></div>
      <div id="affine-checks" role="status" aria-live="polite"></div>
      <p id="affine-count"></p>
      <p id="affine-ic"></p>
      <p id="affine-special" role="status"></p>
      <h4>Try every key</h4>
      <button id="affine-rank" class="action-btn">Try every key</button>
      <p id="affine-notice" role="status" aria-live="polite"></p>
      <div id="affine-ranking" class="affine-ranking" role="region" tabindex="0" aria-label="All affine candidates ranked by English letter frequencies" hidden></div>
      <div id="affine-verdict" role="status" aria-live="polite"></div>
      <h4>Two known letters can determine the key</h4>
      <p>We test every admissible key against all filled pairs. Exactly one match determines the key; no matches means no affine key fits. A plaintext difference other than 0 or 13 allows at most one key, even when the difference is even: the two roots modulo 26 include only one odd multiplier. Several keys can remain only when every pairwise plaintext difference is 0 or 13; add a third pair whose difference from the others is not 0 or 13.</p>
      <div class="affine-controls">
        ${letters('x1', 'First plaintext', 'D')}
        ${letters('y1', 'First ciphertext', 'Y')}
        ${letters('x2', 'Second plaintext', 'E')}
        ${letters('y2', 'Second ciphertext', 'F')}
        ${letters('x3', 'Third plaintext (optional)', '')}
        ${letters('y3', 'Third ciphertext (optional)', '')}
      </div>
      <button id="affine-solve" class="action-btn">Solve the pairs</button>
      <div id="affine-solver" role="status" aria-live="polite"></div>
      <p class="note">Teaching cipher only. This card makes no historical-use claim for the affine generalisation.</p>
    </section>`;
}

/** Explain a unique result using the first pair difference that can fix the key. */
function derivation(pairs: number[][], key: AffineKey): string {
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const [x1, y1] = pairs[i];
      const [x2, y2] = pairs[j];
      const diff = mod26(x1 - x2);
      if (diff === 0 || diff === 13) continue;
      const inv = inverseMod26(diff);
      if (inv !== null) {
        return `Using pairs ${i + 1} and ${j + 1}: a = (y₁ − y₂)(x₁ − x₂)⁻¹ mod 26 = ${mod26(y1 - y2)} × ${inv} mod 26 = ${key.a}; b = y₁ − a·x₁ mod 26 = ${y1} − ${key.a} × ${x1} mod 26 = ${key.b}.`;
      }
      return `The difference is even, so a ≡ ${key.a % 13} (mod 13) has two roots and only one is odd. Then b = y₁ − a·x₁ mod 26 = ${y1} − ${key.a} × ${x1} mod 26 = ${key.b}.`;
    }
  }
  return '';
}

export function initAffine(): void {
  const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(`affine-${id}`) as T;
  const value = (id: string) => el<HTMLInputElement>(id).value;
  const put = (id: string, text: string) => {
    el(id).textContent = text;
  };
  const snapshot = () => JSON.stringify([value('a'), value('b'), value('text')]);
  let previous = '';

  function clearVerdict(id: string) {
    el(id).replaceChildren();
    el(id).className = '';
    delete el(id).dataset.verdict;
  }

  function update() {
    const next = snapshot();
    if (next === previous) return;
    previous = next;
    const retired = !el('ranking').hidden || !!el('solver').dataset.verdict;
    const a = Number(value('a'));
    const b = Number(value('b'));
    const text = value('text');
    const ct = affineEncrypt(text, a, b);
    const inv = inverseMod26(a);
    const keys = validA();

    put('cipher', ct);
    el('ranking').hidden = true;
    el('ranking').replaceChildren();
    clearVerdict('verdict');
    clearVerdict('solver');
    put(
      'notice',
      retired ? 'Key or plaintext changed: previous ranking and solver result retired.' : '',
    );
    clearVerdict('special');
    el('checks').replaceChildren();
    if (inv === null) {
      const distinct = new Set(Array.from({ length: 26 }, (_, x) => mod26(a * x))).size;
      const groups = collisions(a)
        .map((xs) => xs.map((x) => alphabet[x]).join(' = '))
        .join('; ');
      put(
        'checks',
        `Info — not decryptable: a = ${a} is not invertible mod 26; this key destroys information. ${distinct} distinct outputs. Collisions: ${groups}.`,
      );
    } else {
      const checks = [
        ['admissible', keys.includes(a), 'a is admissible'],
        ['inverse', mod26(a * inv) === 1, `${a} × ${inv} mod 26 = ${mod26(a * inv)}`],
        ['roundtrip', affineDecrypt(ct, a, b) === text, 'round trip preserves the plaintext'],
      ] as const;
      for (const [name, ok, label] of checks) {
        const row = document.createElement('p');
        row.dataset.check = name;
        row.dataset.verdict = ok ? 'pass' : 'fail';
        row.className = ok ? 'affine-ok' : 'affine-alarm';
        row.textContent = `${ok ? '✓' : '⚠'} ${label}`;
        el('checks').append(row);
      }
    }
    const count = keys.length * 26;
    put(
      'count',
      `${keys.length} admissible multipliers: ${keys.join(', ')}. ${keys.length} × 26 = ${count} keys, one of which (a = 1, b = 0) leaves the text unchanged. The Fatal Flaw below counts Caesar's keys as 25 because it leaves that identity out; counted the same way, affine has ${count} − 1 = ${count - 1}.`,
    );
    put(
      'ic',
      `Plaintext IC ${indexOfCoincidence(text).toFixed(6)}; ciphertext IC ${indexOfCoincidence(ct).toFixed(6)}.${inv === null ? ' A collision is not a permutation, so IC need not be preserved.' : ' The same frequency fingerprint survives this letter permutation.'}`,
    );
    el('map').replaceChildren();
    for (let x = 0; x < 26; x++) {
      const cell = document.createElement('span');
      cell.setAttribute('role', 'listitem');
      cell.textContent = `${alphabet[x]} (${x}) → ${alphabet[mod26(a * x + b)]} (${mod26(a * x + b)})`;
      el('map').append(cell);
    }
  }

  for (const id of ['a', 'b', 'text']) {
    el(id).addEventListener('input', update);
    el(id).addEventListener('change', update);
  }
  update();

  function presetResult(matches: boolean, name: string) {
    el('special').dataset.verdict = matches ? 'pass' : 'fail';
    el('special').className = matches ? 'affine-ok' : 'affine-alarm';
    put('special', `${matches ? '✓ matches' : '⚠ does not match'} this lab’s ${name}.`);
  }

  el('caesar').addEventListener('click', () => {
    el<HTMLSelectElement>('a').value = '1';
    update();
    presetResult(
      affineEncrypt(value('text'), 1, Number(value('b'))) ===
        caesarEncrypt(value('text'), Number(value('b'))),
      'Caesar',
    );
  });
  el('atbash').addEventListener('click', () => {
    el<HTMLSelectElement>('a').value = '25';
    el<HTMLSelectElement>('b').value = '25';
    update();
    presetResult(affineEncrypt(value('text'), 25, 25) === atbash(value('text')), 'Latin Atbash');
  });

  el('rank').addEventListener('click', () => {
    clearVerdict('verdict');
    el('ranking').replaceChildren();
    el('ranking').hidden = true;
    try {
      if (inverseMod26(Number(value('a'))) === null) {
        throw Error('Not decryptable: choose an admissible multiplier before ranking affine keys.');
      }
      const rows = crackAffine(el('cipher').textContent ?? '');
      const count = (value('text').match(/[a-z]/gi) ?? []).length;
      for (const [i, row] of rows.entries()) {
        const p = document.createElement('p');
        p.className = `affine-candidate${i < 3 ? ' affine-top' : ''}`;
        p.dataset.a = String(row.a);
        p.dataset.b = String(row.b);
        p.textContent = `${i + 1}. a=${row.a}, b=${row.b} · χ²=${row.score.toFixed(3)} · ${row.plaintext}`;
        el('ranking').append(p);
      }
      el('ranking').hidden = false;
      put(
        'notice',
        `${count} letters; ${rows.length} candidates. ${count < 40 ? 'Short texts mislead the statistics. The top row is most likely, not a proven key.' : 'Frequency ranking is a statistical guess; compare the candidate with the actual message.'}`,
      );
      const top = rows[0];
      const matches = top.a === Number(value('a')) && top.b === Number(value('b'));
      const shortText = count < 40;
      let verdict: string;
      if (matches && shortText) {
        el('verdict').className = 'affine-alarm';
        el('verdict').dataset.verdict = 'most-likely';
        verdict = `⚠ MOST LIKELY KEY: a = ${top.a}, b = ${top.b} — the top candidate matches the key in use, but ${count} letters is too few to call it found`;
      } else if (matches) {
        el('verdict').className = 'affine-alarm';
        el('verdict').dataset.verdict = 'recovered';
        verdict = `⚠ VALID KEY — AND RECOVERED BY FREQUENCY: a = ${top.a}, b = ${top.b}.`;
      } else {
        el('verdict').className = 'affine-info';
        el('verdict').dataset.verdict = 'candidate';
        verdict = `Info — MOST LIKELY CANDIDATE: a = ${top.a}, b = ${top.b}.`;
      }
      const negativeClaim = `Multiplying first raises the number of keys to ${validA().length * 26}, but does not make this cipher secure: it is still one fixed letter for one fixed letter, so the frequency attack that breaks Caesar also applies here.`;
      put('verdict', `${verdict} ${negativeClaim}`);
    } catch (e) {
      put('notice', (e as Error).message);
    }
  });

  const pairIds = ['x1', 'y1', 'x2', 'y2', 'x3', 'y3'];
  let pairSnapshot = pairIds.map(value).join('|');
  for (const id of pairIds) {
    el(id).addEventListener('input', () => {
      const next = pairIds.map(value).join('|');
      if (next !== pairSnapshot) {
        pairSnapshot = next;
        const retired = !!el('solver').dataset.verdict;
        clearVerdict('solver');
        if (retired) put('solver', 'Pairs changed: previous solver result retired.');
      }
    });
  }

  el('solve').addEventListener('click', () => {
    clearVerdict('solver');
    try {
      const letter = (id: string) => {
        const v = value(id);
        if (!/^[a-z]$/i.test(v)) throw Error('Each pair needs one Latin letter.');
        return v.toUpperCase().charCodeAt(0) - 65;
      };
      const x1 = letter('x1');
      const y1 = letter('y1');
      const x2 = letter('x2');
      const y2 = letter('y2');
      const third = !!(value('x3') || value('y3'));
      const x3 = third ? letter('x3') : undefined;
      const y3 = third ? letter('y3') : undefined;
      const r = solveFromPairs(x1, y1, x2, y2, x3, y3);
      if ('kind' in r) {
        el('solver').className = 'affine-info';
        el('solver').dataset.verdict = r.kind;
        if (r.kind === 'SeveralKeys') {
          put(
            'solver',
            `Info — ${r.count} affine keys fit these pairs; add a third pair whose difference from the others is not 0 or 13.`,
          );
        } else if (third && !('kind' in solveFromPairs(x1, y1, x2, y2))) {
          put(
            'solver',
            'Info — this key does not explain your third letter; no single key fits all three pairs.',
          );
        } else {
          const mappings = [`${value('x1')}→${value('y1')}`, `${value('x2')}→${value('y2')}`];
          if (third) mappings.push(`${value('x3')}→${value('y3')}`);
          put('solver', `Info — no affine key maps ${mappings.join(' and ')}.`);
        }
        return;
      }
      const pairs = [
        [x1, y1],
        [x2, y2],
      ];
      if (third) pairs.push([x3!, y3!]);
      el('solver').className = 'affine-alarm';
      el('solver').dataset.verdict = 'recovered';
      put(
        'solver',
        `⚠ key found: a = ${r.a}, b = ${r.b}. ${derivation(pairs, r)}${third ? ' This key also explains your third letter.' : ''}`,
      );
    } catch (e) {
      el('solver').className = 'affine-info';
      el('solver').dataset.verdict = 'invalid';
      put('solver', (e as Error).message);
    }
  });
}
