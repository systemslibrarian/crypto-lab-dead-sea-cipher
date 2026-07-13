import './style.css';
import { atbash, atbashHebrew, HEBREW_SCRIPT, HEBREW_SCRIPT_REVERSED } from './ciphers/atbash.ts';
import { caesarEncrypt, caesarDecrypt } from './ciphers/caesar.ts';
import { vigenereEncrypt, vigenereDecrypt } from './ciphers/vigenere.ts';
import { generateOTPKey, otpEncrypt, otpDecrypt, otpKeyReuseAttack, textToBytes, bytesToText, bytesToHex, hexToBytes } from './ciphers/otp.ts';
import { aesEncrypt, aesDecrypt, aesVerifyIntegrity, tamperWithCiphertext } from './ciphers/aes.ts';
import type { AESPayload } from './ciphers/aes.ts';
import { letterFrequency, indexOfCoincidence, ENGLISH_FREQUENCIES } from './analysis/frequency.ts';
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
    <button id="theme-toggle" class="theme-toggle" type="button"></button>
    <div class="cl-hero">
      <div class="cl-hero-main">
        <h1 class="cl-hero-title">Dead Sea Cipher</h1>
        <p class="cl-hero-sub">Atbash · Caesar · Vigenère · One-Time Pad · AES-256-GCM</p>
        <p class="cl-hero-desc">Walk the arc of cryptographic history one era at a time — encrypt with each cipher live, then run the very attack that broke it.</p>
      </div>
      <aside class="cl-hero-why" aria-label="Why it matters">
        <span class="cl-hero-why-label">WHY IT MATTERS</span>
        <p class="cl-hero-why-text">Every confidentiality scheme fails for a structural reason: tiny key space, frequency leakage, key reuse, no integrity. Each generation patches the last one's fatal flaw — and seeing the break is how you learn to trust the fix.</p>
      </aside>
    </div>

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
    <p class="why-today">Atbash matters because it exposes the flaw every substitution cipher inherits: swapping letters one-for-one hides <em>which</em> letter is which, but not <em>how often</em> each appears. That "frequency fingerprint" leak is the thread we follow all the way to Vigenère.</p>

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

    <div class="card">
      <h3>Frequency Leakage Meter</h3>
      <p class="note" style="margin-top:0;margin-bottom:0.6rem">Type in the Latin encoder above. Atbash is a fixed one-to-one swap, so the <strong>shape</strong> of the letter counts is untouched — only the labels move. The Index of Coincidence (chance two random letters match) is <em>identical</em> for plaintext and ciphertext, which is precisely why frequency analysis will later crack Caesar and substitution ciphers.</p>
      <div class="ic-compare">
        <div class="ic-cell"><span class="ic-cell-label">Plaintext IC</span><span class="ic-cell-value" id="atbash-ic-plain">—</span></div>
        <div class="ic-cell"><span class="ic-cell-label">Atbash IC</span><span class="ic-cell-value" id="atbash-ic-cipher">—</span></div>
        <div class="ic-cell"><span class="ic-cell-label">Verdict</span><span class="ic-cell-value" id="atbash-ic-verdict">—</span></div>
      </div>
      <p class="note" style="margin-top:0.5rem">Reference: English ≈ 0.065, random noise ≈ 0.038. An Atbash ciphertext that started as English stays near 0.065 — it leaks.</p>
    </div>

    <div class="card flaw-card">
      <h3>Fatal Flaw</h3>
      <p>${era.fatalFlaw}</p>
      <p class="note">Beyond the tiny key space, the deeper weakness Caesar <em>inherits</em> is above: the frequency fingerprint survives the swap. Adding keys (Caesar's 25 shifts) does not fix that — only Vigenère's multiple alphabets start to flatten it.</p>
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
  const icPlain = document.getElementById('atbash-ic-plain')!;
  const icCipher = document.getElementById('atbash-ic-cipher')!;
  const icVerdict = document.getElementById('atbash-ic-verdict')!;

  function updateLatin(): void {
    const ct = atbash(input.value, 'latin');
    output.textContent = ct;
    const ip = indexOfCoincidence(input.value);
    const ic = indexOfCoincidence(ct);
    icPlain.textContent = ip > 0 ? ip.toFixed(4) : '—';
    icCipher.textContent = ic > 0 ? ic.toFixed(4) : '—';
    // The two ICs are mathematically equal for any bijective letter map.
    if (ip > 0 && Math.abs(ip - ic) < 1e-9) {
      icVerdict.textContent = 'IDENTICAL — leaks';
      icVerdict.className = 'ic-cell-value leak';
    } else if (ip > 0) {
      icVerdict.textContent = 'differs';
      icVerdict.className = 'ic-cell-value';
    } else {
      icVerdict.textContent = '—';
      icVerdict.className = 'ic-cell-value';
    }
  }

  input.addEventListener('input', updateLatin);
  updateLatin();

  hebrewInput.addEventListener('input', () => {
    hebrewOutput.textContent = atbashHebrew(hebrewInput.value);
  });

  loadBtn.addEventListener('click', () => {
    input.value = 'BABEL';
    updateLatin();
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
    <p class="why-today">Caesar shows why a small key is fatal — the same reason a 4-digit PIN is weak: if there are only a handful of keys, an attacker just tries them all.</p>

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
      <p class="note" style="margin-top:0;margin-bottom:0.5rem">A Caesar shift just <em>slides</em> the whole alphabet. The faint dashed line is English's real letter frequencies; the solid bars are this ciphertext's. Break It below slides the bars back until the tallest one snaps onto <strong>E</strong> — that offset <em>is</em> the key.</p>
      <div class="freq-chart" id="caesar-freq-chart" role="img" aria-label="Letter frequency histogram of the ciphertext, overlaid with the reference English distribution">
        <div class="freq-ref-overlay" id="caesar-freq-ref" aria-hidden="true">${buildRefOverlay()}</div>
        ${buildFreqBars()}
      </div>
      <div class="freq-legend" aria-hidden="true">
        <span class="legend-item"><span class="legend-swatch live"></span>ciphertext</span>
        <span class="legend-item"><span class="legend-swatch ref"></span>English reference (peak at E)</span>
      </div>
      <div class="info-row">
        <span class="info-label">IC:</span>
        <span class="info-value" id="caesar-ic">—</span>
        <span class="note" style="margin:0 0 0 0.5rem">(English ≈ 0.065)</span>
      </div>
      <p class="note" id="caesar-ic-def" style="margin-top:0.25rem"><strong>Index of Coincidence (IC)</strong> = the chance two letters picked at random from the text are the same. English clusters on E/T/A, so its IC ≈ 0.065; a Caesar shift just relabels letters without flattening the clusters, so the IC stays ≈ 0.065 — that leakage is exactly what frequency analysis exploits.</p>
    </div>

    <div class="card attack-card">
      <h3>Break It — Frequency Alignment</h3>
      <p class="note" style="margin-top:0;margin-bottom:0.5rem">Watch the histogram slide until its peak lands on E, then read the ranked candidates: the winner is the shift whose decryption best matches English letter statistics (lowest χ²).</p>
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
    `<div class="freq-bar"><div class="bar" data-letter="${l}" style="height:1px"><span class="bar-peak" data-letter="${l}"></span></div><span class="bar-label">${l}</span></div>`
  ).join('');
}

// Faint dashed silhouette of English letter frequencies, drawn behind the live bars.
function buildRefOverlay(): string {
  const maxEng = Math.max(...Object.values(ENGLISH_FREQUENCIES));
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => {
    const h = (ENGLISH_FREQUENCIES[l] / maxEng) * 90;
    return `<div class="freq-ref-bar${l === 'E' ? ' is-e' : ''}" style="height:${h}px"></div>`;
  }).join('');
}

// Returns the letter carrying the tallest bar (the cipher's frequency peak).
function updateFreqChart(containerId: string, text: string): { peak: string | null } {
  const freq = letterFrequency(text);
  const maxPct = Math.max(...freq.map(f => f.percentage), 1);
  const container = document.getElementById(containerId)!;
  let peak: string | null = null;
  let peakPct = -1;
  freq.forEach(f => {
    const bar = container.querySelector(`.bar[data-letter="${f.letter}"]`) as HTMLElement;
    if (bar) {
      bar.style.height = `${(f.percentage / maxPct) * 90}px`;
      bar.classList.remove('is-peak');
    }
    if (f.percentage > peakPct && f.count > 0) { peakPct = f.percentage; peak = f.letter; }
  });
  // Clear any stale peak markers.
  container.querySelectorAll('.bar.is-peak').forEach(b => b.classList.remove('is-peak'));
  return { peak };
}

// Mark which bar is the peak, labelling it (used after the alignment animation).
function markPeakBar(containerId: string, letter: string, label: string): void {
  const container = document.getElementById(containerId)!;
  container.querySelectorAll('.bar.is-peak').forEach(b => b.classList.remove('is-peak'));
  const bar = container.querySelector(`.bar[data-letter="${letter}"]`) as HTMLElement | null;
  if (!bar) return;
  bar.classList.add('is-peak');
  const peakSpan = bar.querySelector('.bar-peak') as HTMLElement | null;
  if (peakSpan) peakSpan.textContent = label;
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

  const chart = document.getElementById('caesar-freq-chart')!;
  const barsRow = () => Array.from(chart.querySelectorAll<HTMLElement>('.bar'));

  function update() {
    const s = parseInt(shift.value);
    shiftDisplay.textContent = String(s);
    const ct = caesarEncrypt(input.value, s);
    output.textContent = ct;
    // Reset any alignment transform from a prior Break It run.
    chart.classList.remove('aligned');
    barsRow().forEach(b => { b.style.transform = ''; b.classList.remove('is-peak'); });
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
    const { peak } = updateFreqChart('caesar-freq-chart', ct);

    // ── Animate: slide every bar left by `likelyShift` columns so the tell-tale
    // peak (the ciphertext's E, disguised as `peak`) lands on the E column. This
    // makes "the shift that aligns the peaks" literally equal "the recovered key".
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const s = result.likelyShift;
    const bars = barsRow();
    // Column width in px (chart has 26 columns with 2px gaps over its width).
    const chartWidth = chart.clientWidth;
    const colWidth = chartWidth / 26;
    chart.classList.add('aligned');
    bars.forEach(b => {
      const dx = -s * colWidth;
      b.style.transform = reduceMotion ? `translateX(${dx}px)` : '';
    });
    if (!reduceMotion) {
      // Force a frame, then apply the slide so the CSS transition animates it.
      requestAnimationFrame(() => {
        bars.forEach(b => { b.style.transform = `translateX(${-s * colWidth}px)`; });
      });
    }
    // After the slide settles, label the peak now sitting over E.
    const settle = reduceMotion ? 0 : 650;
    window.setTimeout(() => {
      if (peak) markPeakBar('caesar-freq-chart', peak, `${peak}→E`);
    }, settle);

    bruteList.style.display = 'block';
    // Candidates already sorted best-first by crackCaesar (lowest χ² = best English fit).
    const bestScore = result.allDecryptions[0].score;
    bruteList.innerHTML = result.allDecryptions.map((d, rank) =>
      `<div class="brute-force-item ${d.shift === result.likelyShift ? 'best' : ''}">
        <span class="shift-label">Shift ${d.shift.toString().padStart(2, ' ')}</span>
        <span class="chi-score" title="chi-squared vs. English letter frequencies (lower is a better fit)">χ² ${d.score.toFixed(0).padStart(4, ' ')}${rank === 0 ? ' ✓' : ''}</span>
        <span class="brute-text">${escapeHtml(d.text)}</span>
      </div>`
    ).join('');

    breakTime.innerHTML = `Winner: <strong>shift ${s}</strong> (χ² ${bestScore.toFixed(0)}, the closest match to English). Solved in <strong>${elapsed}ms</strong> — in 58 BCE this took days of manual counting.`;
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
    <p class="why-today">Vigenère is why we don't reuse a short key over a long message: repeating the keyword every few letters is the same mistake as a Wi-Fi scheme reusing one keystream. Lengthen the key and the frequency leak flattens — but a <em>repeating</em> key still leaves a fingerprint Kasiski can find.</p>

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
      <div class="ic-meter" aria-hidden="true">
        <div class="ic-meter-track">
          <span class="ic-meter-tick random" style="left:0%">random ≈ 0.038</span>
          <span class="ic-meter-tick english" style="left:100%">English ≈ 0.065</span>
          <span class="ic-meter-needle" id="vig-ic-needle" style="left:100%"></span>
        </div>
      </div>
      <p class="note" id="vig-ic-story" style="margin-top:0.4rem">Frequency leakage meter: the needle shows where the ciphertext's IC sits between random noise (0.038) and plain English (0.065). Lengthen the keyword and watch the needle slide left toward random — each key letter spreads one plaintext letter across more ciphertext positions, flattening the fingerprint.</p>
      <p class="note"><strong>Attribution:</strong> Actually invented by Giovan Battista Bellaso in 1553 (<em>La Cifra del. Sig. Giovan Battista Bellaso</em>). Blaise de Vigenère described a different autokey cipher. The misattribution persists to this day.</p>
    </div>

    <div class="card attack-card">
      <h3>Kasiski Examination</h3>
      <p class="note" style="margin-top:0;margin-bottom:0.5rem">Kasiski's insight: when the same plaintext lines up with the same slice of the repeating key, you get an <em>identical</em> ciphertext chunk. So the distance between two matching chunks is a multiple of the key length. Find several such gaps, take their common factor — that's the key length.</p>
      <button class="action-btn" id="vig-kasiski-btn">Run Kasiski Attack</button>
      <div id="vig-kasiski-viz" style="display:none">
        <div class="kasiski-strip-wrap" tabindex="0" role="region" aria-label="Ciphertext with repeated sequences highlighted and their spacings bracketed">
          <div class="kasiski-strip" id="vig-kasiski-strip"></div>
        </div>
        <p class="kasiski-hint note" id="vig-kasiski-hint">Hover or focus a highlighted repeat to see its spacing.</p>
        <div class="kasiski-factors" id="vig-kasiski-factors"></div>
      </div>
      <details class="kasiski-details">
        <summary>Full step-by-step report</summary>
        <div class="kasiski-output" id="vig-kasiski-output" tabindex="0" role="region" aria-label="Kasiski examination step-by-step text report"></div>
      </details>
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
  const icNeedle = document.getElementById('vig-ic-needle') as HTMLElement;

  function update() {
    try {
      const ct = vigenereEncrypt(input.value, keyInput.value);
      output.textContent = ct;
      icPlain.textContent = indexOfCoincidence(input.value).toFixed(4);
      const icC = indexOfCoincidence(ct);
      icCipher.textContent = icC.toFixed(4);
      // Map IC in [0.038, 0.065] onto the meter [0%, 100%], clamped.
      const pct = Math.max(0, Math.min(100, ((icC - 0.038) / (0.065 - 0.038)) * 100));
      icNeedle.style.left = `${pct}%`;
    } catch {
      output.textContent = '(enter a valid key)';
    }
  }

  input.addEventListener('input', update);
  keyInput.addEventListener('input', update);
  update();

  const kasiskiViz = document.getElementById('vig-kasiski-viz')!;
  const kasiskiStrip = document.getElementById('vig-kasiski-strip')!;
  const kasiskiHint = document.getElementById('vig-kasiski-hint')!;
  const kasiskiFactors = document.getElementById('vig-kasiski-factors')!;

  kasiskiBtn.addEventListener('click', () => {
    const ct = output.textContent || '';
    const clean = ct.toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.length < 20) {
      kasiskiViz.style.display = 'block';
      kasiskiStrip.innerHTML = '';
      kasiskiHint.textContent = 'Need at least 20 characters of ciphertext for Kasiski analysis. Try a longer plaintext.';
      kasiskiFactors.innerHTML = '';
      kasiskiOutput.textContent = '';
      return;
    }
    const result = kasiskiExamination(ct);
    kasiskiOutput.textContent = result.explanation;
    kasiskiViz.style.display = 'block';
    renderKasiskiViz(clean, result, kasiskiStrip, kasiskiHint, kasiskiFactors);
  });
}

// Small palette used to color-code distinct repeated sequences in the strip.
const KASISKI_COLORS = ['k0', 'k1', 'k2', 'k3', 'k4', 'k5'];

function renderKasiskiViz(
  clean: string,
  result: ReturnType<typeof kasiskiExamination>,
  strip: HTMLElement,
  hint: HTMLElement,
  factors: HTMLElement,
): void {
  // Pick the most useful repeats to visualize: distinct sequences, each with a
  // gap, capped so the strip stays legible. Each occurrence gets a color class.
  const chosen = result.repeatedSequences
    .filter(r => r.positions.length >= 2)
    .slice(0, KASISKI_COLORS.length);

  // Map each character index → color class (first two occurrences of each repeat).
  const charClass: (string | null)[] = new Array(clean.length).fill(null);
  const brackets: Array<{ start: number; end: number; spacing: number; cls: string; seq: string }> = [];
  chosen.forEach((r, ci) => {
    const cls = KASISKI_COLORS[ci];
    const [p0, p1] = r.positions;
    for (const p of r.positions) {
      for (let i = 0; i < r.sequence.length; i++) {
        if (p + i < clean.length) charClass[p + i] = cls;
      }
    }
    brackets.push({ start: p0, end: p1 + r.sequence.length - 1, spacing: r.spacing, cls, seq: r.sequence });
  });

  // Render the ciphertext as individual spans so we can position brackets under them.
  const cells = clean.split('').map((ch, i) => {
    const cls = charClass[i];
    return `<span class="k-char${cls ? ' ' + cls + ' k-hit' : ''}" data-idx="${i}"${cls ? ` data-seq-cls="${cls}"` : ''}>${ch}</span>`;
  }).join('');

  // Build spacing brackets as an overlay list; positioned via char index ratios.
  const total = clean.length;
  const bracketEls = brackets.map((b, i) => {
    const leftPct = (b.start / total) * 100;
    const widthPct = ((b.end - b.start + 1) / total) * 100;
    return `<div class="k-bracket ${b.cls}" data-seq-cls="${b.cls}" style="left:${leftPct}%;width:${widthPct}%;top:${i * 1.35}rem">
      <span class="k-bracket-line"></span>
      <span class="k-bracket-label">"${b.seq}" · gap ${b.spacing}</span>
    </div>`;
  }).join('');

  const bracketHeight = brackets.length * 1.35 + 0.5;
  strip.innerHTML = `
    <div class="k-text">${cells}</div>
    <div class="k-brackets" style="height:${bracketHeight}rem">${bracketEls}</div>
  `;

  // Hover/focus a highlighted char to spotlight its repeat + matching bracket.
  const chars = Array.from(strip.querySelectorAll<HTMLElement>('.k-char'));
  const bracketNodes = Array.from(strip.querySelectorAll<HTMLElement>('.k-bracket'));
  function spotlight(cls: string | null): void {
    chars.forEach(c => c.classList.toggle('k-dim', cls !== null && c.dataset.seqCls !== cls));
    bracketNodes.forEach(b => b.classList.toggle('k-active', b.dataset.seqCls === cls));
    const b = brackets.find(x => x.cls === cls);
    hint.textContent = b
      ? `"${b.seq}" repeats with a gap of ${b.spacing} letters — the key length must divide ${b.spacing}.`
      : 'Hover or focus a highlighted repeat to see its spacing.';
  }
  chars.forEach(c => {
    const cls = c.dataset.seqCls ?? null;
    if (!cls) return;
    c.tabIndex = 0;
    c.addEventListener('mouseenter', () => spotlight(cls));
    c.addEventListener('mouseleave', () => spotlight(null));
    c.addEventListener('focus', () => spotlight(cls));
    c.addEventListener('blur', () => spotlight(null));
  });

  // Factoring: show each gap collapsing to the common factor = key length.
  const gaps = brackets.map(b => b.spacing);
  const keyLen = result.probableKeyLength;
  const factorRows = brackets.map(b => {
    const facs: number[] = [];
    for (let f = 2; f <= Math.min(b.spacing, 20); f++) if (b.spacing % f === 0) facs.push(f);
    return `<div class="k-factor-row">
      <span class="k-factor-gap ${b.cls}">"${b.seq}" gap ${b.spacing}</span>
      <span class="k-factor-eq">= factors</span>
      <span class="k-factor-list">${facs.map(f => `<span class="k-factor${f === keyLen ? ' k-common' : ''}">${f}</span>`).join('')}</span>
    </div>`;
  }).join('');

  factors.innerHTML = `
    <p class="note" style="margin:0.75rem 0 0.4rem">Every gap shares a common factor. That shared factor is the key length:</p>
    ${factorRows}
    <div class="k-keylen">Common factor across the gaps → <strong>key length = ${keyLen}</strong>${gaps.length ? '' : ' (add more ciphertext for stronger evidence)'}. Each of the ${keyLen} columns is then a simple Caesar shift, cracked by frequency analysis — recovering the key <strong>"${result.repeatedSequences.length ? recoveredKeyFrom(result) : '…'}"</strong>.</div>
  `;
}

// Pull the recovered key out of the text explanation (kept spec-accurate in kasiski.ts).
function recoveredKeyFrom(result: ReturnType<typeof kasiskiExamination>): string {
  const m = result.explanation.match(/RECOVERED KEY: "([A-Z]+)"/);
  return m ? m[1] : '?';
}

// ═══════════════════════════════════════
// OTP PANEL
// ═══════════════════════════════════════
function buildOTPPanel(): string {
  const era = ERAS[3];
  return `
    <h2>One-Time Pad — ${era.year}</h2>
    <p class="era-tagline">${era.tagline}</p>
    <p class="why-today">The OTP is unbreakable on paper, but reuse the pad once and it collapses — the exact bug behind the "two-time pad" breaks of real systems (Venona, some Wi-Fi/PPTP flaws). The lesson: a key you use twice is worse than a shorter key you use once.</p>

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
        <p class="note" style="margin-top:0.75rem">Each column below is one byte position. Because C = P ⊕ K, XORing the two ciphertexts cancels the shared key: <strong>C1 ⊕ C2 = (P1⊕K) ⊕ (P2⊕K) = P1 ⊕ P2</strong>. The key is gone — the two highlighted rows are byte-for-byte equal.</p>
        <div class="xor-grid-wrap" tabindex="0" role="region" aria-label="Byte-aligned XOR grid showing the key-reuse identity C1 XOR C2 equals P1 XOR P2">
          <div class="xor-grid" id="otp-xor-grid"></div>
        </div>
        <div class="xor-identity" id="otp-xor-identity" role="status" aria-live="polite"></div>

        <div class="card attack-card" style="margin-top:0.75rem">
          <h3>Crib Dragging</h3>
          <p style="font-size:0.85rem;margin-bottom:0.5rem">You never recovered the key — but with C1⊕C2 in hand, guessing a word of Message&nbsp;1 immediately hands you the same-position bytes of Message&nbsp;2 (since guess ⊕ (C1⊕C2) = P2). Watch the guess slide across and Message&nbsp;2 turn readable underneath.</p>
          <div class="io-group" style="max-width:300px">
            <label for="otp-crib-input">Guess a word from Message 1</label>
            <input type="text" id="otp-crib-input" value="THE EAGLE" style="max-width:220px">
          </div>
          <label for="otp-crib-pos" style="display:block;font-size:0.75rem;color:var(--text-secondary);margin:0.4rem 0 0.2rem">Slide to position <span id="otp-crib-pos-val">0</span></label>
          <input type="range" id="otp-crib-pos" min="0" value="0" step="1" style="width:100%;max-width:320px;accent-color:var(--accent)">
          <div class="crib-drag" id="otp-crib-drag" style="display:none"></div>
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

  const cribInput = document.getElementById('otp-crib-input') as HTMLInputElement;
  const cribPos = document.getElementById('otp-crib-pos') as HTMLInputElement;
  const cribPosVal = document.getElementById('otp-crib-pos-val')!;
  const cribDrag = document.getElementById('otp-crib-drag')!;

  const MSG1 = 'THE EAGLE HAS LANDED';
  const MSG2 = 'ATTACK AT DAWN SHARP';

  reuseBtn.addEventListener('click', () => {
    const p1 = textToBytes(MSG1);
    const p2 = textToBytes(MSG2);
    const key = generateOTPKey(Math.max(p1.length, p2.length));
    const c1 = otpEncrypt(p1, key);
    const c2 = otpEncrypt(p2, key);
    const xorCiphers = otpKeyReuseAttack(c1, c2); // C1 ⊕ C2

    const n = Math.min(p1.length, p2.length);
    const xorPlains = new Uint8Array(n);
    for (let i = 0; i < n; i++) xorPlains[i] = p1[i] ^ p2[i]; // P1 ⊕ P2

    otpReuseState = { p1Bytes: p1, p2Bytes: p2, c1, c2, key };

    reuseOutput.style.display = 'block';
    renderXorGrid(c1, c2, xorCiphers, xorPlains, key, n);

    // The two computed rows are provably equal; verify and light them up.
    let equal = true;
    for (let i = 0; i < n; i++) if (xorCiphers[i] !== xorPlains[i]) { equal = false; break; }
    const idBox = document.getElementById('otp-xor-identity')!;
    idBox.className = `xor-identity ${equal ? 'match' : 'nomatch'}`;
    idBox.innerHTML = equal
      ? `<span class="xor-check">✓</span> <strong>C1 ⊕ C2 = P1 ⊕ P2</strong> — identical in all ${n} bytes. The shared key cancelled out completely; the attacker now has the XOR of the two plaintexts without ever knowing the key.`
      : `Rows differ (unexpected).`;

    // Configure the crib slider range to valid start positions.
    const maxStart = Math.max(0, n - Math.max(1, textToBytes(cribInput.value).length));
    cribPos.max = String(maxStart);
    cribPos.value = '0';
    cribPosVal.textContent = '0';
    updateCrib();
  });

  function updateCrib(): void {
    if (!otpReuseState.c1 || !otpReuseState.c2) return;
    const xorCiphers = otpKeyReuseAttack(otpReuseState.c1, otpReuseState.c2);
    const n = xorCiphers.length;
    const guessBytes = textToBytes(cribInput.value.toUpperCase());
    const start = Math.min(parseInt(cribPos.value || '0'), Math.max(0, n - 1));
    cribPosVal.textContent = String(start);

    // Recover P2 bytes under the crib: P2[i] = guess[i] ⊕ (C1⊕C2)[i].
    const cells: string[] = [];
    let recovered = '';
    for (let i = 0; i < n; i++) {
      const gi = i - start;
      if (gi >= 0 && gi < guessBytes.length) {
        const rec = guessBytes[gi] ^ xorCiphers[i];
        const ch = rec >= 32 && rec < 127 ? String.fromCharCode(rec) : '·';
        recovered += ch;
        const printable = rec >= 32 && rec < 127;
        cells.push(`<span class="crib-cell landed${printable ? '' : ' junk'}">
          <span class="crib-guess">${escapeHtml(String.fromCharCode(guessBytes[gi]))}</span>
          <span class="crib-arrow">↓</span>
          <span class="crib-out">${escapeHtml(ch)}</span>
        </span>`);
      } else {
        cells.push(`<span class="crib-cell empty"><span class="crib-guess">·</span><span class="crib-arrow"> </span><span class="crib-out">·</span></span>`);
      }
    }

    cribDrag.style.display = 'block';
    const looksEnglish = /^[A-Z ]+$/.test(recovered.trim()) && recovered.trim().length > 0;
    cribDrag.innerHTML = `
      <div class="crib-legend"><span>Guess for Msg&nbsp;1 →</span><span>Recovered Msg&nbsp;2 ↓</span></div>
      <div class="crib-row" tabindex="0" role="region" aria-label="Crib guess aligned over recovered Message 2 bytes">${cells.join('')}</div>
      <p class="note" style="margin-top:0.5rem">Recovered Message 2 slice: <strong class="crib-recovered">${escapeHtml(recovered.replace(/·/g, '_')) || '—'}</strong>. ${looksEnglish ? 'Looks like English — the crib is correctly placed, and this <em>also</em> confirms the Message&nbsp;1 guess.' : 'Gibberish means the guess or position is wrong — slide it until readable text appears.'}</p>
    `;
  }

  cribInput.addEventListener('input', () => {
    if (otpReuseState.c1) {
      const n = otpReuseState.c1.length;
      const maxStart = Math.max(0, n - Math.max(1, textToBytes(cribInput.value).length));
      cribPos.max = String(maxStart);
      if (parseInt(cribPos.value) > maxStart) cribPos.value = String(maxStart);
    }
    updateCrib();
  });
  cribPos.addEventListener('input', updateCrib);
}

// Render C1, C2, C1⊕C2, P1⊕P2, and (revealed) key as byte-aligned monospace rows.
function renderXorGrid(
  c1: Uint8Array, c2: Uint8Array, xorC: Uint8Array, xorP: Uint8Array, key: Uint8Array, n: number,
): void {
  const grid = document.getElementById('otp-xor-grid')!;
  const rows: Array<{ label: string; bytes: Uint8Array; cls: string }> = [
    { label: 'K (shared)', bytes: key, cls: 'row-key' },
    { label: 'C1', bytes: c1, cls: '' },
    { label: 'C2', bytes: c2, cls: '' },
    { label: 'C1 ⊕ C2', bytes: xorC, cls: 'row-identity' },
    { label: 'P1 ⊕ P2', bytes: xorP, cls: 'row-identity' },
  ];
  grid.style.setProperty('--cols', String(n));
  grid.innerHTML = rows.map(r => `
    <div class="xor-row ${r.cls}">
      <span class="xor-row-label">${r.label}</span>
      <div class="xor-bytes">
        ${Array.from({ length: n }, (_, i) =>
          `<span class="xor-byte">${(r.bytes[i] ?? 0).toString(16).padStart(2, '0')}</span>`
        ).join('')}
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════
// AES PANEL
// ═══════════════════════════════════════
function buildAESPanel(): string {
  const era = ERAS[4];
  return `
    <h2>AES-256-GCM — ${era.year}</h2>
    <p class="era-tagline">${era.tagline}</p>
    <p class="why-today">This is the cipher securing your HTTPS connections, disk encryption, and messaging apps right now. It isn't magic — it's the whole arc paying off: counter mode fixes Vigenère's repetition, and an authentication tag fixes the "no integrity" flaw every earlier cipher shared.</p>

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

    <div class="card">
      <h3>Peek Inside GCM</h3>
      <p class="note" style="margin-top:0;margin-bottom:0.6rem">GCM is a stream cipher plus a checksum you can't forge. Encrypt above, then follow the flow: your passphrase is stretched into a 256-bit key, AES runs as a <strong>counter-mode keystream</strong> that XORs your plaintext (no repetition — that's the Vigenère fix), and the ciphertext is fed through <strong>GHASH</strong> to produce a 128-bit authentication tag (the integrity fix).</p>
      <div class="gcm-diagram" id="aes-gcm-diagram" role="img" aria-label="Schematic of AES-GCM: passphrase through PBKDF2 to key; plaintext XOR counter-mode keystream to ciphertext; ciphertext through GHASH to authentication tag">
        <div class="gcm-stage">
          <div class="gcm-box">Passphrase</div>
          <div class="gcm-op">→ PBKDF2<br><span class="gcm-op-sub">200k iters</span></div>
          <div class="gcm-box gcm-key">256-bit key</div>
        </div>
        <div class="gcm-stage gcm-stream">
          <div class="gcm-col">
            <div class="gcm-box gcm-key">key</div>
            <span class="gcm-plus">+ counter</span>
          </div>
          <div class="gcm-op">→ AES<br><span class="gcm-op-sub">counter mode</span></div>
          <div class="gcm-box gcm-stream-box">keystream</div>
          <div class="gcm-xor">⊕</div>
          <div class="gcm-box">plaintext</div>
          <div class="gcm-op">=</div>
          <div class="gcm-box gcm-ct" id="gcm-ct-box">ciphertext</div>
        </div>
        <div class="gcm-stage gcm-auth">
          <div class="gcm-box gcm-ct" id="gcm-ct-box2">ciphertext</div>
          <div class="gcm-op">→ GHASH<br><span class="gcm-op-sub">Galois field</span></div>
          <div class="gcm-box gcm-tag" id="gcm-tag-box">auth tag</div>
        </div>
      </div>
      <p class="note gcm-tamper-note" id="gcm-tamper-note" style="display:none"></p>
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

  const ctBox = document.getElementById('gcm-ct-box')!;
  const ctBox2 = document.getElementById('gcm-ct-box2')!;
  const tagBox = document.getElementById('gcm-tag-box')!;
  const tamperNote = document.getElementById('gcm-tamper-note')!;

  // Short base64 snippet for the schematic boxes so they stay legible.
  const snip = (b64: string) => b64.length > 10 ? b64.slice(0, 8) + '…' : b64;

  function paintDiagram(): void {
    if (!aesPayload) return;
    ctBox.textContent = snip(aesPayload.ciphertext);
    ctBox2.textContent = snip(aesPayload.ciphertext);
    tagBox.textContent = snip(aesPayload.tag);
    ctBox.classList.remove('gcm-changed');
    ctBox2.classList.remove('gcm-changed');
    tagBox.classList.remove('gcm-stale');
    tamperNote.style.display = 'none';
  }

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
      paintDiagram();
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

    // Animate the single changed byte propagating through the schematic. GHASH
    // is a keyed hash over the ciphertext, so any change makes the tag GHASH
    // *would* now produce diverge from the stored tag — which Verify then proves.
    ctBox.textContent = snip(aesPayload.ciphertext);
    ctBox2.textContent = snip(aesPayload.ciphertext);
    ctBox.classList.add('gcm-changed');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      ctBox2.classList.add('gcm-changed');
      window.setTimeout(() => {
        tagBox.classList.add('gcm-stale');
        tamperNote.style.display = 'block';
        tamperNote.innerHTML = '<strong>One flipped ciphertext byte changes the entire GHASH output.</strong> The stored tag was computed over the <em>original</em> ciphertext, so it no longer matches — GCM rejects the message before it even decrypts. Run Verify below to confirm.';
      }, reduceMotion ? 0 : 350);
    }, reduceMotion ? 0 : 350);
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
