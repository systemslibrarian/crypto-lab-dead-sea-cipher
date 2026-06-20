import './style.css';
import { atbash, atbashHebrew, HEBREW_SCRIPT, HEBREW_SCRIPT_REVERSED } from './ciphers/atbash.ts';
import { caesarEncrypt, caesarDecrypt } from './ciphers/caesar.ts';
import { vigenereEncrypt, vigenereDecrypt } from './ciphers/vigenere.ts';
import { generateOTPKey, otpEncrypt, otpDecrypt, otpKeyReuseAttack, textToBytes, bytesToText, bytesToHex, hexToBytes } from './ciphers/otp.ts';
import { aesEncrypt, aesDecrypt, aesVerifyIntegrity, tamperWithCiphertext } from './ciphers/aes.ts';
import type { AESPayload } from './ciphers/aes.ts';
import { letterFrequency, indexOfCoincidence } from './analysis/frequency.ts';
import { kasiskiExamination } from './analysis/kasiski.ts';
import { crackCaesar } from './analysis/caesar-crack.ts';
import { SCRIPTURE_REFERENCES, ERAS, FULL_ARC_REFLECTION, LESSONS_MAP } from './content/scripture.ts';

const app = document.getElementById('app')!;
const themeRoot = document.documentElement;

// The era tabs, in timeline order, plus the synthesizing "Full Arc" view.
const TABS: Array<{ id: string; name: string; year: string }> = [
  ...ERAS.map(e => ({ id: e.id, name: e.name, year: e.year })),
  { id: 'full-arc', name: 'Full Arc', year: '2,600 yrs' },
];

function getTheme(): 'dark' | 'light' {
  return themeRoot.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyThemeToggleState(button: HTMLButtonElement): void {
  const theme = getTheme();
  const isDark = theme === 'dark';
  button.textContent = isDark ? '🌙' : '☀️';
  button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

function initThemeToggle(): void {
  if (!themeRoot.hasAttribute('data-theme')) {
    themeRoot.setAttribute('data-theme', 'dark');
  }

  const toggle = document.getElementById('theme-toggle') as HTMLButtonElement | null;
  if (!toggle) return;

  applyThemeToggleState(toggle);

  toggle.addEventListener('click', () => {
    const nextTheme = getTheme() === 'dark' ? 'light' : 'dark';
    themeRoot.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    applyThemeToggleState(toggle);
  });
}

// ─── Build the full HTML ───
function buildApp(): void {
  app.innerHTML = `
    <header class="site-header">
      <button id="theme-toggle" class="theme-toggle" type="button"></button>
      <h1>Dead Sea Cipher</h1>
      <div class="arc-subtitle">Atbash (~600 BCE) → AES-256-GCM (2001 CE)</div>
    </header>

    <nav class="timeline-nav" role="tablist" aria-label="Cryptographic eras">
      ${TABS.map((t, i) => `<button
        role="tab"
        id="tab-${t.id}"
        data-era="${t.id}"
        aria-controls="panel-${t.id}"
        aria-selected="${i === 0 ? 'true' : 'false'}"
        tabindex="${i === 0 ? '0' : '-1'}"
        class="${i === 0 ? 'active' : ''}">
        ${t.name}<span class="tab-year">${t.year}</span>
      </button>`).join('')}
    </nav>

    <div id="panel-atbash" class="era-panel active" role="tabpanel" aria-labelledby="tab-atbash" tabindex="0">${buildAtbashPanel()}</div>
    <div id="panel-caesar" class="era-panel" role="tabpanel" aria-labelledby="tab-caesar" tabindex="0">${buildCaesarPanel()}</div>
    <div id="panel-vigenere" class="era-panel" role="tabpanel" aria-labelledby="tab-vigenere" tabindex="0">${buildVigenerePanel()}</div>
    <div id="panel-otp" class="era-panel" role="tabpanel" aria-labelledby="tab-otp" tabindex="0">${buildOTPPanel()}</div>
    <div id="panel-aes" class="era-panel" role="tabpanel" aria-labelledby="tab-aes" tabindex="0">${buildAESPanel()}</div>
    <div id="panel-full-arc" class="era-panel" role="tabpanel" aria-labelledby="tab-full-arc" tabindex="0">${buildFullArcPanel()}</div>
  `;

  initThemeToggle();
  initNavigation();
  initAtbash();
  initCaesar();
  initVigenere();
  initOTP();
  initAES();
}

// ─── Navigation (ARIA tabs pattern) ───
function initNavigation(): void {
  const tabs = Array.from(app.querySelectorAll<HTMLButtonElement>('.timeline-nav button'));

  function selectTab(tab: HTMLButtonElement, moveFocus = true): void {
    tabs.forEach(t => {
      const selected = t === tab;
      t.classList.toggle('active', selected);
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
    });
    app.querySelectorAll('.era-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${tab.dataset.era!}`)!.classList.add('active');
    if (moveFocus) tab.focus();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab, false));
    tab.addEventListener('keydown', e => {
      let next = -1;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown': next = (i + 1) % tabs.length; break;
        case 'ArrowLeft':
        case 'ArrowUp': next = (i - 1 + tabs.length) % tabs.length; break;
        case 'Home': next = 0; break;
        case 'End': next = tabs.length - 1; break;
        default: return;
      }
      e.preventDefault();
      selectTab(tabs[next]);
    });
  });
}

// ═══════════════════════════════════════
// ATBASH PANEL
// ═══════════════════════════════════════
function buildAtbashPanel(): string {
  const sr = SCRIPTURE_REFERENCES;
  const era = ERAS[0];
  return `
    <h2>Atbash — ${era.year}</h2>
    <p class="era-tagline">${era.tagline}</p>

    <div class="card scripture-card">
      <h3>Scripture: ${sr.jeremiah_25_26.reference}</h3>
      <p class="scripture-text">"${sr.jeremiah_25_26.english}"</p>
      <span class="scripture-ref">— ${sr.jeremiah_25_26.reference}</span>
      <div style="margin-top:0.75rem">
        <span>Encoded: </span><span class="hebrew-display"><span class="hebrew" lang="he">${sr.jeremiah_25_26.hebrew_encoded}</span></span>
        <span style="margin:0 0.5rem">→</span>
        <span>Decoded: </span><span class="hebrew-display"><span class="hebrew" lang="he">${sr.jeremiah_25_26.hebrew_decoded}</span></span>
        <span style="margin-left:0.5rem;color:var(--text-muted)">(${sr.jeremiah_25_26.encoded_word} → ${sr.jeremiah_25_26.decoded_word})</span>
      </div>
      <p class="note">${sr.jeremiah_25_26.note}</p>
    </div>

    <div class="card scripture-card">
      <h3>Scripture: ${sr.jeremiah_51_41.reference}</h3>
      <p class="scripture-text">"${sr.jeremiah_51_41.english}"</p>
      <span class="scripture-ref">— ${sr.jeremiah_51_41.reference}</span>
      <div style="margin-top:0.75rem">
        <span>Encoded: </span><span class="hebrew-display"><span class="hebrew" lang="he">${sr.jeremiah_51_41.hebrew_encoded}</span></span>
        <span style="margin:0 0.5rem">→</span>
        <span>Decoded: </span><span class="hebrew-display"><span class="hebrew" lang="he">${sr.jeremiah_51_41.hebrew_decoded}</span></span>
      </div>
      <p class="note">${sr.jeremiah_51_41.note}</p>
    </div>

    <div class="card scripture-card">
      <h3>Scripture: ${sr.lev_kamai.reference}</h3>
      <p class="scripture-text">"${sr.lev_kamai.english}"</p>
      <span class="scripture-ref">— ${sr.lev_kamai.reference}</span>
      <div style="margin-top:0.75rem">
        <span>Encoded: </span><span class="hebrew-display"><span class="hebrew" lang="he">${sr.lev_kamai.hebrew_encoded}</span></span>
        <span style="margin:0 0.5rem">→</span>
        <span>Decoded: </span><span class="hebrew-display"><span class="hebrew" lang="he">${sr.lev_kamai.hebrew_decoded}</span></span>
        <span style="margin-left:0.5rem;color:var(--text-muted)">(${sr.lev_kamai.encoded_word} → ${sr.lev_kamai.decoded_word})</span>
      </div>
      <p class="note">${sr.lev_kamai.note}</p>
    </div>

    <div class="card">
      <h3>Hebrew Atbash Mapping</h3>
      <div class="table-scroll">
        <table class="mapping-table" id="atbash-hebrew-table">
          <tr><th scope="row">Letter</th>${HEBREW_SCRIPT.split('').map(c => `<td class="hebrew-cell" lang="he">${c}</td>`).join('')}</tr>
          <tr><th scope="row">Atbash</th>${HEBREW_SCRIPT_REVERSED.split('').map(c => `<td class="hebrew-cell" lang="he">${c}</td>`).join('')}</tr>
        </table>
      </div>
    </div>

    <div class="card">
      <h3>Live Encoder</h3>
      <button class="action-btn" id="atbash-load-jeremiah">Load Jeremiah 25:26 ("BABEL")</button>
      <div class="cipher-io">
        <div class="io-group">
          <label for="atbash-input">Plaintext (Latin)</label>
          <textarea id="atbash-input" placeholder="Type plaintext here...">BABEL</textarea>
        </div>
        <div class="io-group">
          <label id="atbash-output-label">Atbash Output</label>
          <div class="output" id="atbash-output" role="status" aria-live="polite" aria-labelledby="atbash-output-label">YZYVO</div>
        </div>
      </div>
      <div class="cipher-io" style="margin-top:0.5rem">
        <div class="io-group">
          <label for="atbash-hebrew-input">Hebrew Input</label>
          <textarea id="atbash-hebrew-input" dir="rtl" lang="he" class="hebrew" placeholder="Type Hebrew here..." style="font-size:1.2rem">בבל</textarea>
        </div>
        <div class="io-group">
          <label id="atbash-hebrew-output-label">Hebrew Atbash Output</label>
          <div class="output hebrew" id="atbash-hebrew-output" dir="rtl" lang="he" role="status" aria-live="polite" aria-labelledby="atbash-hebrew-output-label" style="font-size:1.2rem">ששך</div>
        </div>
      </div>
    </div>

    <div class="card flaw-card">
      <h3>Fatal Flaw</h3>
      <p>${era.fatalFlaw}</p>
    </div>
    <div class="card fix-card">
      <h3>What the Next Cipher Fixed</h3>
      <p>${era.whatNextFixed}</p>
    </div>
  `;
}

function initAtbash(): void {
  const input = document.getElementById('atbash-input') as HTMLTextAreaElement;
  const output = document.getElementById('atbash-output')!;
  const hebrewInput = document.getElementById('atbash-hebrew-input') as HTMLTextAreaElement;
  const hebrewOutput = document.getElementById('atbash-hebrew-output')!;
  const loadBtn = document.getElementById('atbash-load-jeremiah')!;

  input.addEventListener('input', () => {
    output.textContent = atbash(input.value, 'latin');
  });

  hebrewInput.addEventListener('input', () => {
    hebrewOutput.textContent = atbashHebrew(hebrewInput.value);
  });

  loadBtn.addEventListener('click', () => {
    input.value = 'BABEL';
    output.textContent = atbash('BABEL', 'latin');
  });
}

// ═══════════════════════════════════════
// CAESAR PANEL
// ═══════════════════════════════════════
function buildCaesarPanel(): string {
  const era = ERAS[1];
  return `
    <h2>Caesar Cipher — ${era.year}</h2>
    <p class="era-tagline">${era.tagline}</p>

    <div class="card">
      <h3>Live Cipher</h3>
      <div class="slider-group">
        <label for="caesar-shift">Shift:</label>
        <input type="range" id="caesar-shift" min="1" max="25" value="3" aria-describedby="caesar-shift-display">
        <span class="shift-display" id="caesar-shift-display">3</span>
      </div>
      <div class="cipher-io">
        <div class="io-group">
          <label for="caesar-input">Plaintext</label>
          <textarea id="caesar-input" placeholder="Type plaintext here...">ATTACK AT DAWN</textarea>
        </div>
        <div class="io-group">
          <label id="caesar-output-label">Ciphertext</label>
          <div class="output" id="caesar-output" role="status" aria-live="polite" aria-labelledby="caesar-output-label">DWWDFN DW GDZQ</div>
        </div>
      </div>
      <p class="note">Caesar used a shift of 3, as documented by Suetonius in <em>The Twelve Caesars</em>, Chapter 56.</p>
    </div>

    <div class="card">
      <h3>Frequency Analysis</h3>
      <div class="freq-chart" id="caesar-freq-chart">
        ${buildFreqBars()}
      </div>
      <div class="info-row">
        <span class="info-label">IC:</span>
        <span class="info-value" id="caesar-ic">—</span>
        <span class="note" style="margin:0 0 0 0.5rem">(English ≈ 0.065)</span>
      </div>
    </div>

    <div class="card attack-card">
      <h3>Break It — Brute Force</h3>
      <button class="action-btn" id="caesar-break-btn">Break It</button>
      <div id="caesar-break-time" class="note"></div>
      <div class="brute-force-list" id="caesar-brute-list" style="display:none"></div>
    </div>

    <div class="card flaw-card">
      <h3>Fatal Flaw</h3>
      <p>${era.fatalFlaw}</p>
    </div>
    <div class="card fix-card">
      <h3>What the Next Cipher Fixed</h3>
      <p>${era.whatNextFixed}</p>
    </div>
  `;
}

function buildFreqBars(): string {
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l =>
    `<div class="freq-bar"><div class="bar" data-letter="${l}" style="height:1px"></div><span class="bar-label">${l}</span></div>`
  ).join('');
}

function updateFreqChart(containerId: string, text: string): void {
  const freq = letterFrequency(text);
  const maxPct = Math.max(...freq.map(f => f.percentage), 1);
  const container = document.getElementById(containerId)!;
  freq.forEach(f => {
    const bar = container.querySelector(`.bar[data-letter="${f.letter}"]`) as HTMLElement;
    if (bar) {
      bar.style.height = `${(f.percentage / maxPct) * 90}px`;
    }
  });
}

function initCaesar(): void {
  const input = document.getElementById('caesar-input') as HTMLTextAreaElement;
  const output = document.getElementById('caesar-output')!;
  const shift = document.getElementById('caesar-shift') as HTMLInputElement;
  const shiftDisplay = document.getElementById('caesar-shift-display')!;
  const breakBtn = document.getElementById('caesar-break-btn')!;
  const bruteList = document.getElementById('caesar-brute-list')!;
  const breakTime = document.getElementById('caesar-break-time')!;
  const icDisplay = document.getElementById('caesar-ic')!;

  function update() {
    const s = parseInt(shift.value);
    shiftDisplay.textContent = String(s);
    const ct = caesarEncrypt(input.value, s);
    output.textContent = ct;
    updateFreqChart('caesar-freq-chart', ct);
    icDisplay.textContent = indexOfCoincidence(ct).toFixed(4);
  }

  input.addEventListener('input', update);
  shift.addEventListener('input', update);
  update();

  breakBtn.addEventListener('click', () => {
    const ct = output.textContent || '';
    const start = performance.now();
    const result = crackCaesar(ct);
    const elapsed = (performance.now() - start).toFixed(2);

    bruteList.style.display = 'block';
    bruteList.innerHTML = result.allDecryptions.map(d =>
      `<div class="brute-force-item ${d.shift === result.likelyShift ? 'best' : ''}">
        <span class="shift-label">Shift ${d.shift.toString().padStart(2, ' ')}</span>
        <span>${escapeHtml(d.text)}</span>
      </div>`
    ).join('');

    breakTime.innerHTML = `Completed in <strong>${elapsed}ms</strong>. In 58 BCE, this required days of manual work.`;
  });
}

// ═══════════════════════════════════════
// VIGENÈRE PANEL
// ═══════════════════════════════════════
function buildVigenerePanel(): string {
  const era = ERAS[2];
  return `
    <h2>Vigenère Cipher — ${era.year}</h2>
    <p class="era-tagline">${era.tagline}</p>

    <div class="card">
      <h3>Live Cipher</h3>
      <div class="io-group" style="margin-bottom:0.5rem">
        <label for="vig-key">Keyword</label>
        <input type="text" id="vig-key" value="LEMON" style="max-width:300px">
      </div>
      <div class="cipher-io">
        <div class="io-group">
          <label for="vig-input">Plaintext</label>
          <textarea id="vig-input" placeholder="Type plaintext here...">ATTACKATDAWN</textarea>
        </div>
        <div class="io-group">
          <label id="vig-output-label">Ciphertext</label>
          <div class="output" id="vig-output" role="status" aria-live="polite" aria-labelledby="vig-output-label">LXFOPVEFRNHR</div>
        </div>
      </div>
      <div class="info-row">
        <span class="info-label">IC (plain):</span>
        <span class="info-value" id="vig-ic-plain">—</span>
        <span class="info-label" style="margin-left:1rem">IC (cipher):</span>
        <span class="info-value" id="vig-ic-cipher">—</span>
      </div>
      <p class="note"><strong>Attribution:</strong> Actually invented by Giovan Battista Bellaso in 1553 (<em>La Cifra del. Sig. Giovan Battista Bellaso</em>). Blaise de Vigenère described a different autokey cipher. The misattribution persists to this day.</p>
    </div>

    <div class="card attack-card">
      <h3>Kasiski Examination</h3>
      <button class="action-btn" id="vig-kasiski-btn">Run Kasiski Attack</button>
      <div class="kasiski-output" id="vig-kasiski-output" style="display:none"></div>
    </div>

    <div class="card flaw-card">
      <h3>Fatal Flaw</h3>
      <p>${era.fatalFlaw}</p>
      <p class="note">Kasiski published his attack in 1863 in <em>Die Geheimschriften und die Dechiffrir-Kunst</em>. Charles Babbage broke the cipher around 1854 but never published his method.</p>
    </div>
    <div class="card fix-card">
      <h3>What the Next Cipher Fixed</h3>
      <p>${era.whatNextFixed}</p>
    </div>
  `;
}

function initVigenere(): void {
  const input = document.getElementById('vig-input') as HTMLTextAreaElement;
  const keyInput = document.getElementById('vig-key') as HTMLInputElement;
  const output = document.getElementById('vig-output')!;
  const kasiskiBtn = document.getElementById('vig-kasiski-btn')!;
  const kasiskiOutput = document.getElementById('vig-kasiski-output')!;
  const icPlain = document.getElementById('vig-ic-plain')!;
  const icCipher = document.getElementById('vig-ic-cipher')!;

  function update() {
    try {
      const ct = vigenereEncrypt(input.value, keyInput.value);
      output.textContent = ct;
      icPlain.textContent = indexOfCoincidence(input.value).toFixed(4);
      icCipher.textContent = indexOfCoincidence(ct).toFixed(4);
    } catch {
      output.textContent = '(enter a valid key)';
    }
  }

  input.addEventListener('input', update);
  keyInput.addEventListener('input', update);
  update();

  kasiskiBtn.addEventListener('click', () => {
    const ct = output.textContent || '';
    if (ct.length < 20) {
      kasiskiOutput.style.display = 'block';
      kasiskiOutput.textContent = 'Need at least 20 characters of ciphertext for Kasiski analysis. Try a longer plaintext.';
      return;
    }
    const result = kasiskiExamination(ct);
    kasiskiOutput.style.display = 'block';
    kasiskiOutput.textContent = result.explanation;
  });
}

// ═══════════════════════════════════════
// OTP PANEL
// ═══════════════════════════════════════
function buildOTPPanel(): string {
  const era = ERAS[3];
  return `
    <h2>One-Time Pad — ${era.year}</h2>
    <p class="era-tagline">${era.tagline}</p>

    <div class="card">
      <h3>Live XOR Encryption</h3>
      <div class="cipher-io">
        <div class="io-group">
          <label for="otp-input">Plaintext</label>
          <textarea id="otp-input" placeholder="Type plaintext here...">HELLO WORLD</textarea>
        </div>
        <div class="io-group">
          <label id="otp-key-label">Key (hex)</label>
          <div class="output" id="otp-key" role="status" aria-live="polite" aria-labelledby="otp-key-label" style="font-size:0.75rem">—</div>
        </div>
      </div>
      <button class="action-btn" id="otp-gen-key">Generate Random Key</button>
      <button class="action-btn" id="otp-encrypt-btn">Encrypt</button>
      <div class="cipher-io" style="margin-top:0.5rem">
        <div class="io-group">
          <label id="otp-ciphertext-label">Ciphertext (hex)</label>
          <div class="output" id="otp-ciphertext" role="status" aria-live="polite" aria-labelledby="otp-ciphertext-label" style="font-size:0.75rem">—</div>
        </div>
        <div class="io-group">
          <label id="otp-decrypted-label">Decrypted</label>
          <div class="output" id="otp-decrypted" role="status" aria-live="polite" aria-labelledby="otp-decrypted-label">—</div>
        </div>
      </div>
    </div>

    <div class="card attack-card">
      <h3>Key Reuse Attack Demonstration</h3>
      <p style="margin-bottom:0.75rem;font-size:0.85rem">When the same key encrypts two messages, XOR of the ciphertexts reveals XOR of the plaintexts — eliminating the key entirely.</p>
      <button class="action-btn" id="otp-reuse-btn">Simulate Key Reuse</button>
      <div id="otp-reuse-output" style="display:none">
        <div class="info-row"><span class="info-label">Message 1:</span><span class="info-value" id="otp-reuse-p1"></span></div>
        <div class="info-row"><span class="info-label">Message 2:</span><span class="info-value" id="otp-reuse-p2"></span></div>
        <div class="info-row"><span class="info-label">Shared Key:</span><span class="info-value" id="otp-reuse-key" style="font-size:0.7rem"></span></div>
        <div class="info-row"><span class="info-label">C1:</span><span class="info-value" id="otp-reuse-c1" style="font-size:0.7rem"></span></div>
        <div class="info-row"><span class="info-label">C2:</span><span class="info-value" id="otp-reuse-c2" style="font-size:0.7rem"></span></div>
        <div class="info-row"><span class="info-label">C1 ⊕ C2:</span><span class="info-value" id="otp-reuse-xor" style="font-size:0.7rem"></span></div>
        <div class="info-row"><span class="info-label">P1 ⊕ P2:</span><span class="info-value" id="otp-reuse-pxor" style="font-size:0.7rem"></span></div>

        <div class="card attack-card" style="margin-top:0.75rem">
          <h3>Crib Dragging</h3>
          <p style="font-size:0.85rem;margin-bottom:0.5rem">If you guess one word of Message 1, you can recover the corresponding bytes of Message 2.</p>
          <div class="io-group" style="max-width:300px">
            <label for="otp-crib-input">Guess word at position 0</label>
            <input type="text" id="otp-crib-input" value="THE" style="max-width:200px">
          </div>
          <button class="action-btn" id="otp-crib-btn">Apply Crib</button>
          <div class="crib-result" id="otp-crib-result" style="display:none"></div>
        </div>
      </div>
    </div>

    <div class="card flaw-card">
      <h3>Fatal Flaw</h3>
      <p>${era.fatalFlaw}</p>
    </div>
    <div class="card fix-card">
      <h3>What the Next Cipher Fixed</h3>
      <p>${era.whatNextFixed}</p>
      <p class="note">Shannon proved OTP perfect secrecy in "Communication Theory of Secrecy Systems" (<em>Bell System Technical Journal</em>, 1949). The distinction: <strong>information-theoretic</strong> security (OTP — unbreakable even with infinite computation) vs. <strong>computational</strong> security (AES — unbreakable with any feasible computation).</p>
    </div>
  `;
}

let otpState: { key?: Uint8Array; plainBytes?: Uint8Array; cipherBytes?: Uint8Array } = {};
let otpReuseState: { p1Bytes?: Uint8Array; p2Bytes?: Uint8Array; c1?: Uint8Array; c2?: Uint8Array; key?: Uint8Array } = {};

function initOTP(): void {
  const input = document.getElementById('otp-input') as HTMLTextAreaElement;
  const keyDisplay = document.getElementById('otp-key')!;
  const ctDisplay = document.getElementById('otp-ciphertext')!;
  const decDisplay = document.getElementById('otp-decrypted')!;
  const genBtn = document.getElementById('otp-gen-key')!;
  const encBtn = document.getElementById('otp-encrypt-btn')!;

  genBtn.addEventListener('click', () => {
    const plainBytes = textToBytes(input.value);
    otpState.key = generateOTPKey(plainBytes.length);
    otpState.plainBytes = plainBytes;
    keyDisplay.textContent = bytesToHex(otpState.key);
  });

  encBtn.addEventListener('click', () => {
    const plainBytes = textToBytes(input.value);
    if (!otpState.key || otpState.key.length < plainBytes.length) {
      otpState.key = generateOTPKey(plainBytes.length);
      keyDisplay.textContent = bytesToHex(otpState.key);
    }
    otpState.plainBytes = plainBytes;
    otpState.cipherBytes = otpEncrypt(plainBytes, otpState.key);
    ctDisplay.textContent = bytesToHex(otpState.cipherBytes);
    const dec = otpDecrypt(otpState.cipherBytes, otpState.key);
    decDisplay.textContent = bytesToText(dec);
  });

  // Key reuse demo
  const reuseBtn = document.getElementById('otp-reuse-btn')!;
  const reuseOutput = document.getElementById('otp-reuse-output')!;

  reuseBtn.addEventListener('click', () => {
    const msg1 = 'THE EAGLE HAS LANDED';
    const msg2 = 'ATTACK AT DAWN SHARP';
    const p1 = textToBytes(msg1);
    const p2 = textToBytes(msg2);
    const key = generateOTPKey(Math.max(p1.length, p2.length));
    const c1 = otpEncrypt(p1, key);
    const c2 = otpEncrypt(p2, key);
    const xorCiphers = otpKeyReuseAttack(c1, c2);

    const xorPlains = new Uint8Array(Math.min(p1.length, p2.length));
    for (let i = 0; i < xorPlains.length; i++) xorPlains[i] = p1[i] ^ p2[i];

    otpReuseState = { p1Bytes: p1, p2Bytes: p2, c1, c2, key };

    reuseOutput.style.display = 'block';
    document.getElementById('otp-reuse-p1')!.textContent = msg1;
    document.getElementById('otp-reuse-p2')!.textContent = msg2;
    document.getElementById('otp-reuse-key')!.textContent = bytesToHex(key);
    document.getElementById('otp-reuse-c1')!.textContent = bytesToHex(c1);
    document.getElementById('otp-reuse-c2')!.textContent = bytesToHex(c2);
    document.getElementById('otp-reuse-xor')!.textContent = bytesToHex(xorCiphers);
    document.getElementById('otp-reuse-pxor')!.textContent = bytesToHex(xorPlains);
  });

  // Crib dragging
  const cribBtn = document.getElementById('otp-crib-btn')!;
  const cribInput = document.getElementById('otp-crib-input') as HTMLInputElement;
  const cribResult = document.getElementById('otp-crib-result')!;

  cribBtn.addEventListener('click', () => {
    if (!otpReuseState.c1 || !otpReuseState.c2) return;
    const guess = cribInput.value;
    const guessBytes = textToBytes(guess);
    const xorCiphers = otpKeyReuseAttack(otpReuseState.c1, otpReuseState.c2);

    // XOR the guess with C1⊕C2 at position 0 to recover P2 at that position
    const recoveredBytes = new Uint8Array(guessBytes.length);
    for (let i = 0; i < guessBytes.length && i < xorCiphers.length; i++) {
      recoveredBytes[i] = guessBytes[i] ^ xorCiphers[i];
    }
    const recovered = bytesToText(recoveredBytes);

    cribResult.style.display = 'block';
    cribResult.innerHTML = `
      Guessing "${escapeHtml(guess)}" as start of Message 1...<br>
      Recovered from Message 2 at position 0: <strong>${escapeHtml(recovered)}</strong><br>
      <span class="note">If the recovered text looks like English, the guess is likely correct.</span>
    `;
  });
}

// ═══════════════════════════════════════
// AES PANEL
// ═══════════════════════════════════════
function buildAESPanel(): string {
  const era = ERAS[4];
  return `
    <h2>AES-256-GCM — ${era.year}</h2>
    <p class="era-tagline">${era.tagline}</p>

    <div class="card">
      <h3>Live AES-256-GCM Encryption</h3>
      <div class="cipher-io">
        <div class="io-group">
          <label for="aes-passphrase">Passphrase</label>
          <input type="password" id="aes-passphrase" value="dead-sea-cipher-demo" placeholder="Enter passphrase...">
        </div>
        <div class="io-group">
          <label for="aes-input">Plaintext</label>
          <textarea id="aes-input" placeholder="Type plaintext here...">The arc of cryptography bends toward authenticated encryption.</textarea>
        </div>
      </div>
      <button class="action-btn" id="aes-encrypt-btn">Encrypt</button>
      <div id="aes-output-section" style="display:none">
        <div class="aes-output-grid">
          <span class="label">Ciphertext:</span><span class="value" id="aes-ct"></span>
          <span class="label">IV:</span><span class="value" id="aes-iv"></span>
          <span class="label">Salt:</span><span class="value" id="aes-salt"></span>
          <span class="label">Auth Tag:</span><span class="value" id="aes-tag"></span>
        </div>
        <div class="info-row" style="margin-top:0.5rem">
          <span class="info-label">PBKDF2:</span>
          <span class="info-value">SHA-256, 200,000 iterations, 256-bit key</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Decrypt</h3>
      <button class="action-btn" id="aes-decrypt-btn">Decrypt</button>
      <div class="output" id="aes-decrypted" role="status" aria-live="polite" aria-label="Decrypted output" style="margin-top:0.5rem">—</div>
    </div>

    <div class="card attack-card">
      <h3>Tamper Detection (GCM Integrity)</h3>
      <p style="font-size:0.85rem;margin-bottom:0.5rem">GCM authentication tag covers the entire ciphertext. One changed bit causes complete verification failure.</p>
      <button class="action-btn danger" id="aes-tamper-btn">Tamper with Ciphertext (flip 1 bit)</button>
      <button class="action-btn" id="aes-verify-btn">Verify Integrity</button>
      <div id="aes-verify-result" role="status" aria-live="polite"></div>
    </div>

    <div class="card fix-card">
      <h3>What 2,600 Years Taught Us</h3>
      <ul class="lessons-list">
        ${LESSONS_MAP.map(l => `<li>
          <div class="flaw-text">⚠ ${l.flaw}</div>
          <div class="solution-text">✓ ${l.aesSolution}</div>
        </li>`).join('')}
      </ul>
    </div>

    <div class="card flaw-card">
      <h3>Current Status</h3>
      <p>${era.fatalFlaw}</p>
    </div>
  `;
}

let aesPayload: AESPayload | null = null;
let aesTampered = false;

function initAES(): void {
  const passInput = document.getElementById('aes-passphrase') as HTMLInputElement;
  const textInput = document.getElementById('aes-input') as HTMLTextAreaElement;
  const encryptBtn = document.getElementById('aes-encrypt-btn')!;
  const outputSection = document.getElementById('aes-output-section')!;
  const decryptBtn = document.getElementById('aes-decrypt-btn')!;
  const decryptedDisplay = document.getElementById('aes-decrypted')!;
  const tamperBtn = document.getElementById('aes-tamper-btn')!;
  const verifyBtn = document.getElementById('aes-verify-btn')!;
  const verifyResult = document.getElementById('aes-verify-result')!;

  encryptBtn.addEventListener('click', async () => {
    encryptBtn.textContent = 'Encrypting...';
    try {
      aesPayload = await aesEncrypt(textInput.value, passInput.value);
      aesTampered = false;
      outputSection.style.display = 'block';
      document.getElementById('aes-ct')!.textContent = aesPayload.ciphertext;
      document.getElementById('aes-iv')!.textContent = aesPayload.iv;
      document.getElementById('aes-salt')!.textContent = aesPayload.salt;
      document.getElementById('aes-tag')!.textContent = aesPayload.tag;
      verifyResult.innerHTML = '';
      decryptedDisplay.textContent = '—';
    } catch (e: any) {
      outputSection.style.display = 'block';
      document.getElementById('aes-ct')!.textContent = 'Error: ' + e.message;
    }
    encryptBtn.textContent = 'Encrypt';
  });

  decryptBtn.addEventListener('click', async () => {
    if (!aesPayload) {
      decryptedDisplay.textContent = '(encrypt something first)';
      return;
    }
    try {
      const plaintext = await aesDecrypt(aesPayload, passInput.value);
      decryptedDisplay.textContent = plaintext;
      decryptedDisplay.className = 'output';
    } catch {
      decryptedDisplay.textContent = '❌ Decryption failed — authentication error';
      decryptedDisplay.className = 'output';
      decryptedDisplay.style.color = 'var(--danger)';
    }
  });

  tamperBtn.addEventListener('click', () => {
    if (!aesPayload) {
      verifyResult.innerHTML = '<div class="status error">Encrypt something first.</div>';
      return;
    }
    aesPayload = tamperWithCiphertext(aesPayload);
    aesTampered = true;
    document.getElementById('aes-ct')!.textContent = aesPayload.ciphertext;
    verifyResult.innerHTML = '<div class="status error">⚠ One bit has been flipped in the ciphertext.</div>';
  });

  verifyBtn.addEventListener('click', async () => {
    if (!aesPayload) {
      verifyResult.innerHTML = '<div class="status error">Encrypt something first.</div>';
      return;
    }
    const ok = await aesVerifyIntegrity(aesPayload, passInput.value);
    if (ok) {
      verifyResult.innerHTML = '<div class="status success">✓ Integrity verified — ciphertext has not been tampered with.</div>';
    } else {
      verifyResult.innerHTML = '<div class="status error">❌ Integrity check FAILED — ciphertext has been tampered with. GCM authentication tag does not match.</div>';
    }
  });
}

// ═══════════════════════════════════════
// FULL ARC PANEL
// ═══════════════════════════════════════
function buildFullArcPanel(): string {
  const sr = SCRIPTURE_REFERENCES;
  return `
    <h2>The Full Arc</h2>
    <p class="era-tagline">2,600 years of cryptographic history in one page</p>

    <div class="card scripture-card">
      <p class="scripture-text">"${sr.jeremiah_25_26.english}"</p>
      <span class="scripture-ref">— ${sr.jeremiah_25_26.reference}</span>
    </div>

    <div class="arc-timeline">
      ${ERAS.map(era => `
        <div class="arc-item">
          <span class="arc-year">${era.year}</span>
          <div class="arc-name">${era.name}</div>
          <div class="arc-flaw">⚠ ${era.fatalFlaw.split('.')[0]}.</div>
          <div class="arc-lesson">${era.whatItFixed}</div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <h3>Reflection</h3>
      <p style="font-size:0.9rem;line-height:1.8;white-space:pre-line">${FULL_ARC_REFLECTION}</p>
    </div>

    <div class="card scripture-card" style="margin-top:2rem;text-align:center">
      <p class="scripture-text">"${sr.closing.english}"</p>
      <span class="scripture-ref">— ${sr.closing.reference}</span>
    </div>
  `;
}

// ─── Utility ───
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Launch ───
buildApp();
