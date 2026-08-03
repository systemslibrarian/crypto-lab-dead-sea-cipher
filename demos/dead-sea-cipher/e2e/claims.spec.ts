import { expect, test as base, type Page } from '@playwright/test';

/**
 * Functional claims gate.
 *
 * The a11y spec proves the six era panels are reachable; nothing proved any of
 * them computed the right thing, or that the attacks the README advertises
 * actually land. This suite drives all five ciphers and asserts:
 *
 *  - Atbash: the encoder round-trips (it is its own inverse), and the leakage
 *    meter's verdict is checked against the two IC values the page printed
 *    beside it — the whole point of the panel is that they are equal.
 *  - Caesar: "Break It" recovers the shift the slider is actually set to, the
 *    ranked candidate list is sorted best-first with the winner marked, and the
 *    winning row's decryption is the plaintext that was typed in. Changing the
 *    input retires the verdict instead of leaving it beside a new ciphertext.
 *  - Vigenère: Kasiski recovers the keyword that was used, every bracketed gap
 *    is divisible by the reported key length, and too-short input reaches the
 *    refusal state naming its cause. An invalid key reaches the error state and
 *    takes the IC readouts and any prior attack down with it.
 *  - OTP: the C1⊕C2 = P1⊕P2 grid is verified byte-for-byte against the hex the
 *    page rendered, crib dragging recovers the real Message 2 text at the right
 *    offset and gibberish elsewhere, and editing the plaintext retires a
 *    ciphertext that no longer corresponds to it.
 *  - AES-256-GCM: encrypt/decrypt round-trips through real Web Crypto, tampering
 *    is rejected and names tampering as the cause, a wrong passphrase is
 *    rejected and names the passphrase, and the GCM schematic marks the stale
 *    tag only after a tamper. The GHASH panel's recomputed tag is checked
 *    against the tag Web Crypto actually sealed with, byte for byte; the bit
 *    the learner selects is the one that flips; the "N of 128 bits moved"
 *    figure is recounted from the two hex strings the page rendered; and
 *    editing an input retires exactly the claims that input supported.
 *
 * Verdicts are asserted against values the page itself computed and rendered.
 */

const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors, `uncaught page exceptions: ${errors.join(' | ')}`).toEqual([]);
    },
    { auto: true },
  ],
});

/** Web Crypto PBKDF2 at 200k iterations is slow; AES tests need headroom. */
const CRYPTO_TIMEOUT = 30_000;

async function openEra(page: Page, era: string): Promise<void> {
  await page.locator(`#tab-${era}`).click();
  await expect(page.locator(`#panel-${era}`)).toHaveClass(/active/);
  await expect(page.locator(`#tab-${era}`)).toHaveAttribute('aria-selected', 'true');
}

function hexToBytes(hex: string): number[] {
  return (hex.match(/.{2}/g) ?? []).map((byte) => parseInt(byte, 16));
}

/**
 * Natural English prose, long enough that its letter distribution is the real
 * one — a pangram would sit near random and defeat the point of an IC readout.
 */
const ENGLISH_PROSE =
  'WE HOLD THESE TRUTHS TO BE SELF EVIDENT THAT ALL MEN ARE CREATED EQUAL THAT THEY ' +
  'ARE ENDOWED BY THEIR CREATOR WITH CERTAIN UNALIENABLE RIGHTS THAT AMONG THESE ARE ' +
  'LIFE LIBERTY AND THE PURSUIT OF HAPPINESS THAT TO SECURE THESE RIGHTS GOVERNMENTS ' +
  'ARE INSTITUTED AMONG MEN DERIVING THEIR JUST POWERS FROM THE CONSENT OF THE GOVERNED';

/* ------------------------------------------------------------------- Atbash */

test('Atbash: the encoder is its own inverse and the leakage verdict matches the ICs beside it', async ({
  page,
}) => {
  await page.goto('.');

  const input = page.locator('#atbash-input');
  const output = page.locator('#atbash-output');

  await expect(output).toHaveText('YZYVO'); // BABEL, the panel's own default

  const plaintext = ENGLISH_PROSE;
  await input.fill(plaintext);
  const ciphertext = (await output.innerText()).trim();
  expect(ciphertext).not.toBe(plaintext);

  // Feeding the ciphertext back must return the plaintext: Atbash is an
  // involution, and this is the page proving it with its own encoder.
  await input.fill(ciphertext);
  await expect(output).toHaveText(plaintext);

  // The panel's headline claim: the IC survives the swap untouched. Assert the
  // verdict against the two numbers the page printed, not against a constant.
  await input.fill(plaintext);
  const icPlain = Number(await page.locator('#atbash-ic-plain').innerText());
  const icCipher = Number(await page.locator('#atbash-ic-cipher').innerText());
  expect(icPlain).toBeGreaterThan(0);
  expect(icCipher).toBe(icPlain);
  await expect(page.locator('#atbash-ic-verdict')).toHaveText('IDENTICAL — leaks');
  await expect(page.locator('#atbash-ic-verdict')).toHaveClass(/leak/);
  // English prose sits near the ~0.065 reference the panel quotes, nowhere near
  // the ~0.038 of random noise — which is what makes "it leaks" a real finding.
  expect(icPlain).toBeGreaterThan(0.055);

  // Empty input is the no-reading state, not a fabricated one.
  await input.fill('');
  await expect(page.locator('#atbash-ic-plain')).toHaveText('—');
  await expect(page.locator('#atbash-ic-cipher')).toHaveText('—');
  await expect(page.locator('#atbash-ic-verdict')).toHaveText('—');
  await expect(page.locator('#atbash-ic-verdict')).not.toHaveClass(/leak/);
});

/* ------------------------------------------------------------------- Caesar */

test('Caesar: Break It recovers the shift in use and its winning row decrypts to the typed plaintext', async ({
  page,
}) => {
  await page.goto('.');
  await openEra(page, 'caesar');

  const plaintext = 'THE ENEMY FLEET WILL ATTACK THE HARBOR AT DAWN TOMORROW MORNING';
  await page.locator('#caesar-input').fill(plaintext);
  await page.locator('#caesar-shift').fill('11');
  await expect(page.locator('#caesar-shift-display')).toHaveText('11');

  const ciphertext = (await page.locator('#caesar-output').innerText()).trim();
  expect(ciphertext).not.toBe(plaintext);

  await page.locator('#caesar-break-btn').click();

  // The attack has to name the shift the slider is actually set to — a value
  // the page derived from χ², not one it was handed.
  const verdict = page.locator('#caesar-break-time');
  await expect(verdict).toContainText('Winner: shift 11');
  await expect(verdict).toContainText('closest match to English');

  const rows = page.locator('#caesar-brute-list .brute-force-item');
  await expect(rows).toHaveCount(26);

  const parsed = await rows.evaluateAll((nodes) =>
    nodes.map((node) => ({
      shift: Number(node.querySelector('.shift-label')!.textContent!.replace('Shift', '').trim()),
      score: Number(
        node.querySelector('.chi-score')!.textContent!.replace('χ²', '').replace('✓', '').trim(),
      ),
      text: node.querySelector('.brute-text')!.textContent!.trim(),
      best: node.classList.contains('best'),
    })),
  );

  // Ranked best-first: a "ranked by χ² fitness" list that is not sorted is a
  // claim the page does not keep.
  for (let index = 1; index < parsed.length; index += 1) {
    expect(parsed[index].score).toBeGreaterThanOrEqual(parsed[index - 1].score);
  }
  // Exactly one winner, it is rank 0, and it is the shift in use.
  expect(parsed.filter((row) => row.best)).toHaveLength(1);
  expect(parsed[0].best).toBe(true);
  expect(parsed[0].shift).toBe(11);
  // The winning row's decryption is the plaintext that was typed in.
  expect(parsed[0].text).toBe(plaintext);
  // Every one of the 26 shifts is represented exactly once.
  expect(new Set(parsed.map((row) => row.shift)).size).toBe(26);

  // The peak bar is labelled and marked after the alignment settles.
  await expect(page.locator('#caesar-freq-chart .bar.is-peak')).toHaveCount(1);
  await expect(page.locator('#caesar-freq-chart .bar.is-peak .bar-peak')).toContainText('→E');
});

test('Caesar: the break verdict is retired when the ciphertext it described changes', async ({
  page,
}) => {
  await page.goto('.');
  await openEra(page, 'caesar');

  await page.locator('#caesar-shift').fill('3');
  await page.locator('#caesar-break-btn').click();
  await expect(page.locator('#caesar-break-time')).toContainText('Winner: shift 3');
  await expect(page.locator('#caesar-brute-list')).toBeVisible();

  // Regression: the ranked list and "Winner: shift 3" used to survive a new
  // shift, so the page displayed one ciphertext while announcing the key to a
  // different one.
  await page.locator('#caesar-shift').fill('17');
  await expect(page.locator('#caesar-shift-display')).toHaveText('17');
  await expect(page.locator('#caesar-break-time')).toHaveText('');
  await expect(page.locator('#caesar-brute-list')).toBeHidden();
  await expect(page.locator('#caesar-freq-chart .bar.is-peak')).toHaveCount(0);

  // Editing the plaintext retires it too, and the attack still works after.
  await page.locator('#caesar-break-btn').click();
  await expect(page.locator('#caesar-break-time')).toContainText('Winner: shift 17');
  await page.locator('#caesar-input').fill('RETREAT TO THE NORTHERN RIDGE BEFORE NIGHTFALL');
  await expect(page.locator('#caesar-break-time')).toHaveText('');
  await page.locator('#caesar-break-btn').click();
  await expect(page.locator('#caesar-break-time')).toContainText('Winner: shift 17');
});

/* ---------------------------------------------------------------- Vigenère */

test('Vigenère: Kasiski recovers the keyword and every bracketed gap divides the reported key length', async ({
  page,
}) => {
  await page.goto('.');
  await openEra(page, 'vigenere');

  const keyword = 'LEMON';
  await page.locator('#vig-key').fill(keyword);
  await page.locator('#vig-input').fill(ENGLISH_PROSE);

  // Polyalphabetic substitution must flatten the fingerprint the Atbash panel
  // showed surviving: the ciphertext IC has to sit below the plaintext IC.
  const icPlain = Number(await page.locator('#vig-ic-plain').innerText());
  const icCipher = Number(await page.locator('#vig-ic-cipher').innerText());
  expect(icPlain).toBeGreaterThan(icCipher);

  await page.locator('#vig-kasiski-btn').click();
  await expect(page.locator('#vig-kasiski-viz')).toBeVisible();

  const factors = page.locator('#vig-kasiski-factors');
  const keyLength = Number((await factors.innerText()).match(/key length = (\d+)/)![1]);
  expect(keyLength).toBe(keyword.length);

  // Every gap the page bracketed must be divisible by the length it concluded
  // from them — the factoring shown has to support the answer shown.
  const gaps = await page
    .locator('#vig-kasiski-strip .k-bracket-label')
    .evaluateAll((nodes) => nodes.map((n) => Number(n.textContent!.match(/gap (\d+)/)![1])));
  expect(gaps.length).toBeGreaterThan(0);
  for (const gap of gaps) {
    expect(gap % keyLength, `gap ${gap} is not a multiple of key length ${keyLength}`).toBe(0);
  }
  // And the highlighted factor is present in each row's factor list.
  const commonFactors = await page
    .locator('#vig-kasiski-factors .k-factor.k-common')
    .allInnerTexts();
  expect(commonFactors.length).toBe(gaps.length);
  for (const factor of commonFactors) {
    expect(Number(factor)).toBe(keyLength);
  }

  // The recovered key is the one that was actually used, and the collapsed
  // step-by-step report the README promises backs the visual with the same
  // numbers rather than a second, independently computed answer.
  await expect(factors).toContainText(`recovering the key "${keyword}"`);
  await page.locator('.kasiski-details summary').click();
  const report = page.locator('#vig-kasiski-output');
  await expect(report).toBeVisible();
  await expect(report).toContainText(`RECOVERED KEY: "${keyword}"`);
  await expect(report).toContainText(`PROBABLE KEY LENGTH: ${keyLength}`);
  await expect(report).toContainText(`COLUMN ANALYSIS (key length = ${keyLength})`);
  // One column per key letter, and the letters spell the recovered key.
  const columns = (await report.innerText()).match(/key letter '([A-Z])'/g) ?? [];
  expect(columns).toHaveLength(keyLength);
  expect(columns.map((line) => line.charAt(line.length - 2)).join('')).toBe(keyword);

  // Kasiski's premise, checked against the strip the page drew: each bracketed
  // sequence really does occur twice in this ciphertext, exactly `gap` letters
  // apart. A bracket whose gap did not land on a second copy would be a
  // decoration rather than evidence.
  const strip = await page
    .locator('#vig-kasiski-strip .k-char')
    .evaluateAll((nodes) => nodes.map((n) => n.textContent).join(''));
  expect(strip.length).toBeGreaterThan(20);
  const labels = await page.locator('#vig-kasiski-strip .k-bracket-label').allInnerTexts();
  expect(labels).toHaveLength(gaps.length);
  for (const label of labels) {
    const [, sequence, gapText] = label.match(/"([A-Z]+)"\s*·\s*gap (\d+)/)!;
    const gap = Number(gapText);
    const first = strip.indexOf(sequence);
    expect(first, `${sequence} is not in the highlighted ciphertext`).toBeGreaterThanOrEqual(0);
    expect(
      strip.slice(first + gap, first + gap + sequence.length),
      `${sequence} does not repeat ${gap} letters later`,
    ).toBe(sequence);
  }
  // And every occurrence carries a highlight class so it is visible as a repeat.
  expect(await page.locator('#vig-kasiski-strip .k-char.k-hit').count()).toBeGreaterThan(0);
});

test('Vigenère: too-short ciphertext and an invalid key both reach a failure state naming the cause', async ({
  page,
}) => {
  await page.goto('.');
  await openEra(page, 'vigenere');

  // 1. Not enough ciphertext for Kasiski — refuse, and say why.
  await page.locator('#vig-input').fill('HI THERE');
  await page.locator('#vig-kasiski-btn').click();
  await expect(page.locator('#vig-kasiski-hint')).toContainText(
    'Need at least 20 characters of ciphertext for Kasiski analysis',
  );
  await expect(page.locator('#vig-kasiski-strip .k-char')).toHaveCount(0);
  await expect(page.locator('#vig-kasiski-factors')).toBeEmpty();
  await expect(page.locator('#vig-kasiski-output')).toBeEmpty();

  // 2. A key with no letters in it is rejected, and the leakage readouts go
  //    with it — regression: they used to keep the last valid numbers, so the
  //    meter described a ciphertext the panel was refusing to produce.
  await page.locator('#vig-input').fill('ATTACK AT DAWN AND HOLD THE BRIDGE UNTIL RELIEVED');
  await expect(page.locator('#vig-output')).not.toHaveText('(enter a valid key)');
  await page.locator('#vig-key').fill('12345');
  await expect(page.locator('#vig-output')).toHaveText('(enter a valid key)');
  await expect(page.locator('#vig-ic-plain')).toHaveText('—');
  await expect(page.locator('#vig-ic-cipher')).toHaveText('—');

  // 3. A valid key clears it and the readouts come back.
  await page.locator('#vig-key').fill('CIPHER');
  await expect(page.locator('#vig-output')).not.toHaveText('(enter a valid key)');
  expect(Number(await page.locator('#vig-ic-cipher').innerText())).toBeGreaterThan(0);
});

test('Vigenère: a completed Kasiski run is retired when its ciphertext changes', async ({
  page,
}) => {
  await page.goto('.');
  await openEra(page, 'vigenere');

  await page.locator('#vig-key').fill('LEMON');
  await page.locator('#vig-input').fill(
    'THE MEASURE OF A CIPHER IS NOT HOW CLEVER IT LOOKS BUT HOW LONG IT SURVIVES ' +
      'THE MEASURE OF A CIPHER IS NOT HOW CLEVER IT LOOKS BUT HOW LONG IT SURVIVES',
  );
  await page.locator('#vig-kasiski-btn').click();
  await expect(page.locator('#vig-kasiski-factors')).toContainText('key length =');

  // Regression: the highlighted repeats, gap brackets, factor rows and the
  // RECOVERED KEY all used to survive a keyword change, so the panel kept
  // asserting a key length and key for a ciphertext that no longer existed.
  await page.locator('#vig-key').fill('ZEBRAQUARTZ');
  await expect(page.locator('#vig-kasiski-viz')).toBeHidden();
  await expect(page.locator('#vig-kasiski-factors')).toBeEmpty();
  await expect(page.locator('#vig-kasiski-output')).toBeEmpty();

  // The attack still runs afterwards, against the new ciphertext.
  await page.locator('#vig-kasiski-btn').click();
  await expect(page.locator('#vig-kasiski-viz')).toBeVisible();
  await expect(page.locator('#vig-kasiski-factors')).toContainText('key length =');
});

/* ---------------------------------------------------------------------- OTP */

test('OTP: the key-reuse grid satisfies C1 ⊕ C2 = P1 ⊕ P2 in the hex it actually rendered', async ({
  page,
}) => {
  await page.goto('.');
  await openEra(page, 'otp');

  await page.locator('#otp-reuse-btn').click();
  await expect(page.locator('#otp-xor-grid .xor-row')).toHaveCount(5);

  const rows = await page.locator('#otp-xor-grid .xor-row').evaluateAll((nodes) =>
    nodes.map((node) => ({
      label: node.querySelector('.xor-row-label')!.textContent!.trim(),
      bytes: Array.from(node.querySelectorAll('.xor-byte')).map((b) => b.textContent!.trim()),
    })),
  );
  const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.bytes]));
  expect(Object.keys(byLabel).sort()).toEqual(
    ['C1', 'C1 ⊕ C2', 'C2', 'K (shared)', 'P1 ⊕ P2'].sort(),
  );

  const n = byLabel['C1'].length;
  expect(n).toBeGreaterThan(0);
  for (const bytes of Object.values(byLabel)) {
    expect(bytes).toHaveLength(n);
    for (const byte of bytes) expect(byte).toMatch(/^[0-9a-f]{2}$/);
  }

  const c1 = hexToBytes(byLabel['C1'].join(''));
  const c2 = hexToBytes(byLabel['C2'].join(''));
  const xorC = hexToBytes(byLabel['C1 ⊕ C2'].join(''));
  const xorP = hexToBytes(byLabel['P1 ⊕ P2'].join(''));
  const key = hexToBytes(byLabel['K (shared)'].join(''));

  for (let i = 0; i < n; i += 1) {
    // The row the page labels C1 ⊕ C2 has to be the XOR of the rows above it.
    expect(xorC[i], `byte ${i}: C1 ⊕ C2 row is not C1 xor C2`).toBe(c1[i] ^ c2[i]);
    // The identity the panel exists to demonstrate.
    expect(xorP[i], `byte ${i}: the identity does not hold`).toBe(xorC[i]);
    // And the shared key really is shared: it recovers printable ASCII from both.
    expect(c1[i] ^ key[i]).toBeGreaterThanOrEqual(32);
    expect(c2[i] ^ key[i]).toBeGreaterThanOrEqual(32);
  }
  // C1 and C2 are genuinely different ciphertexts under the one key.
  expect(byLabel['C1'].join('')).not.toBe(byLabel['C2'].join(''));

  const identity = page.locator('#otp-xor-identity');
  await expect(identity).toHaveClass(/match/);
  await expect(identity).not.toHaveClass(/nomatch/);
  await expect(identity).toContainText(`identical in all ${n} bytes`);
});

test('OTP: crib dragging recovers Message 2 at the right offset and gibberish elsewhere', async ({
  page,
}) => {
  await page.goto('.');
  await openEra(page, 'otp');
  await page.locator('#otp-reuse-btn').click();

  const recovered = page.locator('.crib-recovered');
  // The panel seeds the crib with a word from Message 1 at position 0, so the
  // slice underneath must be the true opening of Message 2.
  await expect(page.locator('#otp-crib-drag')).toBeVisible();
  await expect(recovered).toHaveText('ATTACK AT');
  await expect(page.locator('#otp-crib-drag')).toContainText('Looks like English');

  // Slide the same crib somewhere it does not belong: the recovered slice must
  // change and the page must say so rather than keep claiming a hit.
  await page.locator('#otp-crib-pos').fill('7');
  await expect(page.locator('#otp-crib-pos-val')).toHaveText('7');
  const offText = (await recovered.innerText()).trim();
  expect(offText).not.toBe('ATTACK AT');
  await expect(page.locator('#otp-crib-drag')).toContainText('Gibberish means the guess');

  // A wrong guess at the right position is also rejected.
  await page.locator('#otp-crib-pos').fill('0');
  await page.locator('#otp-crib-input').fill('ZZZZZZZZZ');
  await expect(recovered).not.toHaveText('ATTACK AT');
  await expect(page.locator('#otp-crib-drag')).toContainText('Gibberish means the guess');

  // And the true crib at the true offset comes back.
  await page.locator('#otp-crib-input').fill('THE EAGLE');
  await expect(recovered).toHaveText('ATTACK AT');
});

test('OTP: encryption round-trips, and a ciphertext is retired when its inputs change', async ({
  page,
}) => {
  await page.goto('.');
  await openEra(page, 'otp');

  const plaintext = 'HELLO WORLD';
  await page.locator('#otp-encrypt-btn').click();

  const keyHex = (await page.locator('#otp-key').innerText()).trim();
  const cipherHex = (await page.locator('#otp-ciphertext').innerText()).trim();
  expect(keyHex).toMatch(/^[0-9a-f]+$/);
  expect(cipherHex).toMatch(/^[0-9a-f]+$/);
  expect(cipherHex.length).toBe(plaintext.length * 2);
  await expect(page.locator('#otp-decrypted')).toHaveText(plaintext);

  // The displayed key must be the one that turns the displayed ciphertext back
  // into the displayed plaintext — verified here, not taken on trust.
  const key = hexToBytes(keyHex);
  const cipher = hexToBytes(cipherHex);
  const decoded = cipher.map((byte, i) => String.fromCharCode(byte ^ key[i])).join('');
  expect(decoded).toBe(plaintext);

  // Regression: editing the plaintext used to leave the old ciphertext and the
  // old "Decrypted" readout on screen, so the three panels described three
  // different messages.
  await page.locator('#otp-input').fill('A COMPLETELY DIFFERENT MESSAGE');
  await expect(page.locator('#otp-ciphertext')).toHaveText('—');
  await expect(page.locator('#otp-decrypted')).toHaveText('—');

  await page.locator('#otp-encrypt-btn').click();
  await expect(page.locator('#otp-decrypted')).toHaveText('A COMPLETELY DIFFERENT MESSAGE');

  // Redrawing the key must retire the ciphertext too: a key that no longer
  // decrypts what is on screen beside it is worse than no key at all.
  await page.locator('#otp-gen-key').click();
  await expect(page.locator('#otp-ciphertext')).toHaveText('—');
  await expect(page.locator('#otp-decrypted')).toHaveText('—');
  const newKey = (await page.locator('#otp-key').innerText()).trim();
  expect(newKey).not.toBe(keyHex);
});

/* ---------------------------------------------------------------------- AES */

test('AES-256-GCM: encrypt/decrypt round-trips and every field the panel shows is well formed', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('.');
  await openEra(page, 'aes');

  const plaintext = 'The arc of cryptography bends toward authenticated encryption.';
  await page.locator('#aes-encrypt-btn').click();
  await expect(page.locator('#aes-ct')).not.toBeEmpty({ timeout: CRYPTO_TIMEOUT });

  const b64 = /^[A-Za-z0-9+/]+={0,2}$/;
  const iv = (await page.locator('#aes-iv').innerText()).trim();
  const salt = (await page.locator('#aes-salt').innerText()).trim();
  const tag = (await page.locator('#aes-tag').innerText()).trim();
  const ciphertext = (await page.locator('#aes-ct').innerText()).trim();
  for (const field of [iv, salt, tag, ciphertext]) expect(field).toMatch(b64);
  // The sizes the panel advertises: 12-byte IV, 16-byte salt, 128-bit tag.
  expect(atob(iv).length).toBe(12);
  expect(atob(salt).length).toBe(16);
  expect(atob(tag).length).toBe(16);
  // GCM is a stream mode: ciphertext length equals plaintext length.
  expect(atob(ciphertext).length).toBe(plaintext.length);
  await expect(page.locator('#aes-output-section')).toBeVisible();

  await page.locator('#aes-verify-btn').click();
  await expect(page.locator('#aes-verify-result .status.success')).toContainText(
    'Integrity verified',
    { timeout: CRYPTO_TIMEOUT },
  );

  await page.locator('#aes-decrypt-btn').click();
  await expect(page.locator('#aes-decrypted')).toHaveText(plaintext, { timeout: CRYPTO_TIMEOUT });

  // Encrypting twice must not produce the same ciphertext — a fresh IV and salt
  // are what make that true, and the panel prints both.
  await page.locator('#aes-encrypt-btn').click();
  await expect(page.locator('#aes-ct')).not.toHaveText(ciphertext, { timeout: CRYPTO_TIMEOUT });
  expect((await page.locator('#aes-iv').innerText()).trim()).not.toBe(iv);
  expect((await page.locator('#aes-salt').innerText()).trim()).not.toBe(salt);
});

test('AES-256-GCM: a flipped bit is rejected and the rejection names tampering as the cause', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('.');
  await openEra(page, 'aes');

  await page.locator('#aes-encrypt-btn').click();
  await expect(page.locator('#aes-ct')).not.toBeEmpty({ timeout: CRYPTO_TIMEOUT });
  await page.locator('#aes-decrypt-btn').click();
  await expect(page.locator('#aes-decrypted')).not.toHaveText('—', { timeout: CRYPTO_TIMEOUT });

  const before = (await page.locator('#aes-ct').innerText()).trim();
  const tagBefore = (await page.locator('#aes-tag').innerText()).trim();

  await page.locator('#aes-tamper-btn').click();
  const after = (await page.locator('#aes-ct').innerText()).trim();
  expect(after).not.toBe(before);
  // Exactly one byte differs — the panel promises a single flipped bit.
  const beforeBytes = atob(before);
  const afterBytes = atob(after);
  expect(afterBytes.length).toBe(beforeBytes.length);
  const differing = [...beforeBytes].filter((ch, i) => ch !== afterBytes[i]);
  expect(differing).toHaveLength(1);
  // The stored tag is untouched: that is precisely why it no longer matches.
  expect((await page.locator('#aes-tag').innerText()).trim()).toBe(tagBefore);

  // Regression: the successfully decrypted plaintext used to stay on screen
  // under the tamper warning, so a message that could no longer be decrypted
  // was still displayed as decrypted.
  await expect(page.locator('#aes-decrypted')).toHaveText('—');
  await expect(page.locator('#aes-verify-result .status.error')).toContainText(
    'Bit 0 of ciphertext byte 0 has been flipped',
  );

  // The schematic marks the tag stale and explains why.
  await expect(page.locator('#gcm-tag-box')).toHaveClass(/gcm-stale/, { timeout: 5_000 });
  await expect(page.locator('#gcm-ct-box')).toHaveClass(/gcm-changed/);
  await expect(page.locator('#gcm-tamper-note')).toBeVisible();
  await expect(page.locator('#gcm-tamper-note')).toContainText('no longer matches');

  // Live GCM verification rejects it, and names tampering.
  await page.locator('#aes-verify-btn').click();
  const verdict = page.locator('#aes-verify-result .status.error');
  await expect(verdict).toContainText('Integrity check FAILED', { timeout: CRYPTO_TIMEOUT });
  await expect(verdict).toContainText('tampered with');
  await expect(page.locator('#aes-verify-result .status.success')).toHaveCount(0);

  await page.locator('#aes-decrypt-btn').click();
  await expect(page.locator('#aes-decrypted')).toContainText('Decryption failed', {
    timeout: CRYPTO_TIMEOUT,
  });
  await expect(page.locator('#aes-decrypted')).toContainText('tampered with');

  // Re-encrypting clears the tamper state end to end, and the recovered
  // plaintext is not left painted in the failure colour.
  await page.locator('#aes-encrypt-btn').click();
  await expect(page.locator('#aes-decrypted')).toHaveText('—', { timeout: CRYPTO_TIMEOUT });
  await expect(page.locator('#gcm-tag-box')).not.toHaveClass(/gcm-stale/);
  await expect(page.locator('#gcm-tamper-note')).toBeHidden();
  await page.locator('#aes-decrypt-btn').click();
  await expect(page.locator('#aes-decrypted')).not.toHaveText('—', { timeout: CRYPTO_TIMEOUT });
  const colour = await page.locator('#aes-decrypted').evaluate((el) => el.style.color);
  expect(colour, 'a successful decryption is still painted as a failure').toBe('');
});

test('AES-256-GCM: a wrong passphrase is rejected and blamed on the passphrase, not on tampering', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('.');
  await openEra(page, 'aes');

  await page.locator('#aes-encrypt-btn').click();
  await expect(page.locator('#aes-ct')).not.toBeEmpty({ timeout: CRYPTO_TIMEOUT });

  await page.locator('#aes-passphrase').fill('not-the-passphrase');
  await page.locator('#aes-verify-btn').click();

  const verdict = page.locator('#aes-verify-result .status.error');
  await expect(verdict).toContainText('Integrity check FAILED', { timeout: CRYPTO_TIMEOUT });
  // Regression: this used to read "ciphertext has been tampered with", blaming
  // an attack for what is only a wrong key. Nothing touched the ciphertext.
  await expect(verdict).toContainText('passphrase does not derive the key');
  await expect(verdict).not.toContainText('tampered with');

  await page.locator('#aes-decrypt-btn').click();
  await expect(page.locator('#aes-decrypted')).toContainText('Decryption failed', {
    timeout: CRYPTO_TIMEOUT,
  });
  await expect(page.locator('#aes-decrypted')).toContainText('passphrase');
  await expect(page.locator('#aes-decrypted')).not.toContainText('tampered');
});

test('AES-256-GCM: the page recomputes GHASH and lands on the tag Web Crypto sealed with', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('.');
  await openEra(page, 'aes');

  // Before any run there is no GHASH table to read — only the invitation.
  await expect(page.locator('#gcm-ghash-panel')).toBeHidden();
  await expect(page.locator('#gcm-ghash-idle')).toBeVisible();

  await page.locator('#aes-encrypt-btn').click();
  await expect(page.locator('#gcm-ghash-panel')).toBeVisible({ timeout: CRYPTO_TIMEOUT });

  const hex32 = /^[0-9a-f]{32}$/;
  const h = (await page.locator('#ghash-h').innerText()).trim();
  const ghashOut = (await page.locator('#ghash-out').innerText()).trim();
  const mask = (await page.locator('#ghash-mask').innerText()).trim();
  const computedTag = (await page.locator('#ghash-tag').innerText()).trim();
  const sealedTag = (await page.locator('#ghash-reference').innerText()).trim();
  for (const field of [h, ghashOut, mask, computedTag, sealedTag]) expect(field).toMatch(hex32);

  // tag = GHASH ⊕ mask, in the hex the page actually rendered.
  const maskBytes = hexToBytes(mask);
  expect(hexToBytes(ghashOut).map((b, i) => b ^ maskBytes[i])).toEqual(hexToBytes(computedTag));

  // …and that recomputation equals the tag Web Crypto produced, which the AES
  // panel prints separately in base64. Same 16 bytes, two independent paths.
  const b64Tag = (await page.locator('#aes-tag').innerText()).trim();
  const b64TagBytes = [...atob(b64Tag)].map((ch) => ch.charCodeAt(0));
  expect(hexToBytes(sealedTag)).toEqual(b64TagBytes);
  expect(hexToBytes(computedTag)).toEqual(b64TagBytes);

  await expect(page.locator('#ghash-verdict .status.success')).toContainText('all 128 bits agree');
  // Block count is derived from the ciphertext length, not a constant.
  const ctLen = atob((await page.locator('#aes-ct').innerText()).trim()).length;
  await expect(page.locator('#ghash-blocks')).toContainText(
    `${Math.ceil(ctLen / 16)} ciphertext block`,
  );

  // The idle note is genuinely gone, not merely marked hidden (see the
  // [hidden] trap regression at the bottom of this file).
  expect(
    await page
      .locator('#gcm-ghash-idle')
      .evaluate((el) => getComputedStyle(el as HTMLElement).display),
  ).toBe('none');
});

test('AES-256-GCM: a learner-chosen bit is the one that flips, and the moved tag bits are counted', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('.');
  await openEra(page, 'aes');

  await page.locator('#aes-encrypt-btn').click();
  await expect(page.locator('#gcm-ghash-panel')).toBeVisible({ timeout: CRYPTO_TIMEOUT });

  const sealedTag = (await page.locator('#ghash-reference').innerText()).trim();
  const before = (await page.locator('#aes-ct').innerText()).trim();
  const ctLen = atob(before).length;
  // The selector advertises the real ciphertext length, not a guess.
  await expect(page.locator('#aes-tamper-range')).toHaveText(`of ${ctLen} bytes (0–${ctLen - 1})`);
  expect(await page.locator('#aes-tamper-byte').getAttribute('max')).toBe(String(ctLen - 1));

  // Pick a byte and bit that are not the old hardcoded (0, 0).
  const byteIndex = 11;
  const bitIndex = 5;
  await page.locator('#aes-tamper-byte').fill(String(byteIndex));
  await page.locator('#aes-tamper-bit').fill(String(bitIndex));
  await page.locator('#aes-tamper-btn').click();

  const after = (await page.locator('#aes-ct').innerText()).trim();
  const beforeBytes = [...atob(before)].map((ch) => ch.charCodeAt(0));
  const afterBytes = [...atob(after)].map((ch) => ch.charCodeAt(0));
  const changed = beforeBytes.map((_, i) => i).filter((i) => beforeBytes[i] !== afterBytes[i]);
  expect(changed).toEqual([byteIndex]);
  expect(beforeBytes[byteIndex] ^ afterBytes[byteIndex]).toBe(1 << bitIndex);
  await expect(page.locator('#aes-verify-result .status.error')).toContainText(
    `Bit ${bitIndex} of ciphertext byte ${byteIndex} has been flipped`,
  );

  // GHASH is recomputed over the ciphertext now on screen: the tag it produces
  // must be a different value from the sealed one, and the page must report the
  // gap it measured rather than a canned "the entire output changes".
  await expect(page.locator('#ghash-verdict .status.error')).toContainText('of 128', {
    timeout: CRYPTO_TIMEOUT,
  });
  const recomputed = (await page.locator('#ghash-tag').innerText()).trim();
  expect(recomputed).not.toBe(sealedTag);
  expect((await page.locator('#ghash-reference').innerText()).trim()).toBe(sealedTag);

  const verdict = await page.locator('#ghash-verdict').innerText();
  const moved = Number(/(\d+) of 128/.exec(verdict)![1]);
  const sealedBytes = hexToBytes(sealedTag);
  const actual = hexToBytes(recomputed)
    .map((b, i) => b ^ sealedBytes[i])
    .reduce((n, b) => n + b.toString(2).replace(/0/g, '').length, 0);
  expect(moved).toBe(actual);
  expect(moved).toBeGreaterThan(0);

  // And the real oracle agrees: Web Crypto rejects it.
  await page.locator('#aes-verify-btn').click();
  await expect(page.locator('#aes-verify-result .status.error')).toContainText(
    'Integrity check FAILED',
    { timeout: CRYPTO_TIMEOUT },
  );
});

test('AES-256-GCM: editing an input retires the ciphertext, the tag and the GHASH verdict', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('.');
  await openEra(page, 'aes');

  await page.locator('#aes-encrypt-btn').click();
  await expect(page.locator('#gcm-ghash-panel')).toBeVisible({ timeout: CRYPTO_TIMEOUT });
  await page.locator('#aes-verify-btn').click();
  await expect(page.locator('#aes-verify-result .status.success')).toContainText(
    'Integrity verified',
    { timeout: CRYPTO_TIMEOUT },
  );

  // Editing the plaintext leaves every displayed result describing bytes that
  // are no longer the ones on screen. They must retire, not sit there
  // endorsing an encryption of a message nobody encrypted.
  await page.locator('#aes-input').fill('A different message entirely.');
  await expect(page.locator('#aes-output-section')).toBeHidden();
  await expect(page.locator('#gcm-ghash-panel')).toBeHidden();
  await expect(page.locator('#gcm-ghash-idle')).toBeVisible();
  await expect(page.locator('#aes-verify-result')).toBeEmpty();
  await expect(page.locator('#aes-decrypted')).toHaveText('—');
  await expect(page.locator('#gcm-tag-box')).toHaveText('auth tag');
  await expect(page.locator('#aes-tamper-range')).toHaveText('encrypt first');

  // The controls are genuinely disarmed, not just visually cleared.
  await page.locator('#aes-verify-btn').click();
  await expect(page.locator('#aes-verify-result .status.error')).toContainText(
    'Encrypt something first',
  );

  // The passphrase retires less, and should: it is also the key the learner
  // decrypts *with*, so typing a new one is the wrong-key experiment rather
  // than a new encryption. The sealed ciphertext and its GHASH are still
  // exactly what they were; only the verdicts reached under the old passphrase
  // are now unsupported, and only those may disappear.
  await page.locator('#aes-encrypt-btn').click();
  await expect(page.locator('#gcm-ghash-panel')).toBeVisible({ timeout: CRYPTO_TIMEOUT });
  await page.locator('#aes-decrypt-btn').click();
  await expect(page.locator('#aes-decrypted')).toHaveText('A different message entirely.', {
    timeout: CRYPTO_TIMEOUT,
  });
  await page.locator('#aes-verify-btn').click();
  await expect(page.locator('#aes-verify-result .status.success')).toBeVisible({
    timeout: CRYPTO_TIMEOUT,
  });
  const sealedCt = (await page.locator('#aes-ct').innerText()).trim();

  await page.locator('#aes-passphrase').fill('a different passphrase');
  await expect(page.locator('#aes-verify-result')).toBeEmpty();
  await expect(page.locator('#aes-decrypted')).toHaveText('—');
  await expect(page.locator('#aes-output-section')).toBeVisible();
  expect((await page.locator('#aes-ct').innerText()).trim()).toBe(sealedCt);
  await expect(page.locator('#gcm-ghash-panel')).toBeVisible();

  // …and the wrong key now reaches the failure state, blamed on the key.
  await page.locator('#aes-verify-btn').click();
  await expect(page.locator('#aes-verify-result .status.error')).toContainText(
    'passphrase does not derive the key',
    { timeout: CRYPTO_TIMEOUT },
  );
});

test('AES-256-GCM: the controls refuse to act before anything has been encrypted', async ({
  page,
}) => {
  await page.goto('.');
  await openEra(page, 'aes');

  await page.locator('#aes-verify-btn').click();
  await expect(page.locator('#aes-verify-result .status.error')).toContainText(
    'Encrypt something first',
  );
  await page.locator('#aes-tamper-btn').click();
  await expect(page.locator('#aes-verify-result .status.error')).toContainText(
    'Encrypt something first',
  );
  await page.locator('#aes-decrypt-btn').click();
  await expect(page.locator('#aes-decrypted')).toHaveText('(encrypt something first)');
  // No output was fabricated.
  await expect(page.locator('#aes-output-section')).toBeHidden();
});

/* --------------------------------------------------------------- Regression */

test('every era tab reaches its panel and only one panel is ever shown', async ({ page }) => {
  await page.goto('.');

  const tabs = await page.locator('.timeline-nav button').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset.era!),
  );
  expect(tabs).toEqual(['atbash', 'caesar', 'vigenere', 'otp', 'aes', 'full-arc']);

  for (const era of tabs) {
    await openEra(page, era);
    await expect(page.locator('.era-panel.active')).toHaveCount(1);
    await expect(page.locator(`#panel-${era}`)).toBeVisible();
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
  }

  // The tablist is arrow-key navigable, as the ARIA tabs pattern requires.
  await page.locator('#tab-atbash').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-caesar')).toBeFocused();
  await expect(page.locator('#panel-caesar')).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator('#panel-full-arc')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.locator('#panel-atbash')).toBeVisible();
});

/**
 * The `[hidden]` override trap: any author `display` on an element beats the UA
 * `[hidden] { display: none }` rule, so a panel shipping the attribute renders
 * anyway and every `el.hidden = true` is a silent no-op.
 */
test('no element carrying the hidden attribute is actually rendered', async ({ page }) => {
  await page.goto('.');
  await page.waitForTimeout(200);

  const leaks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[hidden]'))
      .filter((el) => getComputedStyle(el as HTMLElement).display !== 'none')
      .map((el) => ({
        tag: (el as HTMLElement).tagName.toLowerCase(),
        cls: (el as HTMLElement).className?.toString().slice(0, 60) ?? '',
      })),
  );
  expect(leaks, `elements marked hidden that still render: ${JSON.stringify(leaks)}`).toEqual([]);
});
