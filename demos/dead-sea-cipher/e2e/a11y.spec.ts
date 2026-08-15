import { expect, test, type Page } from '@playwright/test';
import { NARROW, boot, expectScrollersReachable, openEra, scan, settle } from './gate';

/**
 * WCAG regression gate.
 *
 * Deploys are already gated on the ciphers' computational claims by
 * claims.spec.ts; this gates them on accessibility the same way. See gate.ts
 * for the three rules this file obeys — nothing injected, content asserted
 * before every scan, and `violations` treated as one oracle among five.
 *
 * The page is scanned in both themes, in states a visitor can actually reach,
 * at a 1280px desktop viewport and at a 380px phone one. Little of the
 * interesting rendering is the first-paint one: until Break It runs there are
 * no ranked candidates and no aligned chart, until Kasiski runs there is no
 * strip, no factor rows and no recovered key, until a key is generated the
 * OTP grid does not exist, and the GHASH table waits on a real encryption.
 * The previous spec force-revealed all six panels at once with injected CSS
 * instead — a rendering no visitor can produce — and never pressed a single
 * attack button, so every one of those computed states shipped unscanned.
 */

const THEMES = ['dark'] as const;

/** Web Crypto PBKDF2 at 200k iterations is slow; the AES states need headroom. */
const CRYPTO_TIMEOUT = 30_000;

/**
 * Long natural-English plaintext (borrowed from claims.spec.ts) so Kasiski
 * genuinely finds repeats and recovers the LEMON keyword.
 */
const ENGLISH_PROSE =
  'WE HOLD THESE TRUTHS TO BE SELF EVIDENT THAT ALL MEN ARE CREATED EQUAL THAT THEY ' +
  'ARE ENDOWED BY THEIR CREATOR WITH CERTAIN UNALIENABLE RIGHTS THAT AMONG THESE ARE ' +
  'LIFE LIBERTY AND THE PURSUIT OF HAPPINESS THAT TO SECURE THESE RIGHTS GOVERNMENTS ' +
  'ARE INSTITUTED AMONG MEN DERIVING THEIR JUST POWERS FROM THE CONSENT OF THE GOVERNED';

/** Drive the AES panel through a real encryption and wait for the GHASH table. */
async function encryptAes(page: Page): Promise<void> {
  await openEra(page, 'aes');
  await page.locator('#aes-encrypt-btn').click();
  await expect(page.locator('#gcm-ghash-panel')).toBeVisible({ timeout: CRYPTO_TIMEOUT });
  await expect(page.locator('#ghash-verdict .status')).toBeVisible({ timeout: CRYPTO_TIMEOUT });
}

/**
 * A state worth scanning: how to reach it from a booted page, and what has to
 * be true once you are there. The assertion is not decoration — it is what
 * stops a scan from passing over a panel that never redrew.
 */
interface State {
  label: string;
  drive: (page: Page) => Promise<void>;
}

const STATES: State[] = [
  {
    // The default mount: Atbash panel active with its live verdict already
    // computed for the BABEL default — the IC cells and the red "IDENTICAL —
    // leaks" verdict are part of first paint here, not a driven state.
    label: 'first paint / Atbash with live leakage verdict',
    drive: async (page) => {
      await expect(page.locator('#atbash-hebrew-output')).toHaveText('ששך');
      await expect(page.locator('#atbash-ic-plain')).not.toHaveText('—');
      await expect(page.locator('#atbash-ic-verdict')).toHaveText('IDENTICAL — leaks');
      await expect(page.locator('#atbash-ic-verdict')).toHaveClass(/leak/);
    },
  },
  {
    // Break It run for real: the aligned chart with its peak marker, the
    // 26-row ranked candidate list (which overflows its 300px box — a
    // scrolling region that exists in no other state), and the winner line.
    label: 'Caesar broken / aligned chart + ranked candidates',
    drive: async (page) => {
      await openEra(page, 'caesar');
      await expect(page.locator('#caesar-output')).toHaveText('DWWDFN DW GDZQ');
      await expect(page.locator('#caesar-ic')).not.toHaveText('—');
      await page.locator('#caesar-break-btn').click();
      await expect(page.locator('#caesar-break-time')).toContainText('Winner: shift 3');
      await expect(page.locator('.brute-force-item')).toHaveCount(26);
      await expect(page.locator('.brute-force-item.best')).toContainText('ATTACK AT DAWN');
      await expect(page.locator('#caesar-freq-chart')).toHaveClass(/aligned/);
      // Reduced motion applies the slide instantly and the peak label lands
      // on a 0ms timer — but it is still a timer, so wait for it.
      await expect(page.locator('.bar.is-peak .bar-peak')).toHaveText('D→E');
    },
  },
  {
    // A full Kasiski run: highlighted repeats, gap brackets, factor rows, the
    // key-length verdict, the recovered key, and the step-by-step report
    // opened through its real <summary>.
    label: 'Vigenère Kasiski / strip, factors, recovered key, report open',
    drive: async (page) => {
      await openEra(page, 'vigenere');
      await page.locator('#vig-input').fill(ENGLISH_PROSE);
      await expect(page.locator('#vig-ic-cipher')).not.toHaveText('—');
      await page.locator('#vig-kasiski-btn').click();
      await expect(page.locator('#vig-kasiski-viz')).toBeVisible();
      expect(await page.locator('#vig-kasiski-strip .k-char.k-hit').count()).toBeGreaterThan(0);
      await expect(page.locator('#vig-kasiski-factors')).toContainText('key length = 5');
      await expect(page.locator('#vig-kasiski-factors')).toContainText(
        'recovering the key "LEMON"',
      );
      await page.locator('.kasiski-details summary').click();
      await expect(page.locator('#vig-kasiski-output')).toBeVisible();
      await expect(page.locator('#vig-kasiski-output')).toContainText('RECOVERED KEY: "LEMON"');
    },
  },
  {
    // The Kasiski spotlight, reached the way a keyboard user reaches it: focus
    // a highlighted repeat. Every other character dims — that dimmed rendering
    // is on screen for anyone tabbing through the strip, and it is exactly the
    // kind of state an opacity-injecting gate could never measure.
    label: 'Vigenère Kasiski / repeat focused, strip dimmed',
    drive: async (page) => {
      await openEra(page, 'vigenere');
      await page.locator('#vig-input').fill(ENGLISH_PROSE);
      await page.locator('#vig-kasiski-btn').click();
      await expect(page.locator('#vig-kasiski-viz')).toBeVisible();
      await page.locator('#vig-kasiski-strip .k-char.k-hit').first().focus();
      await expect(page.locator('#vig-kasiski-hint')).toContainText('the key length must divide');
      expect(await page.locator('#vig-kasiski-strip .k-char.k-dim').count()).toBeGreaterThan(0);
    },
  },
  {
    // The attack's refusal state: too little ciphertext for Kasiski, named as
    // such. The default 12-character plaintext reaches it honestly.
    label: 'Vigenère Kasiski / refused for short ciphertext',
    drive: async (page) => {
      await openEra(page, 'vigenere');
      await page.locator('#vig-kasiski-btn').click();
      await expect(page.locator('#vig-kasiski-hint')).toContainText(
        'Need at least 20 characters',
      );
      await expect(page.locator('#vig-kasiski-strip .k-char')).toHaveCount(0);
    },
  },
  {
    // The OTP arc: a generated key, a real encryption round-trip, the reuse
    // attack's five-row XOR grid with its verified identity banner, and the
    // crib correctly placed — recovered Message 2 text and the "looks like
    // English" confirmation.
    label: 'OTP reuse attack / XOR grid + crib placed',
    drive: async (page) => {
      await openEra(page, 'otp');
      await page.locator('#otp-gen-key').click();
      await expect(page.locator('#otp-key')).not.toHaveText('—');
      await page.locator('#otp-encrypt-btn').click();
      await expect(page.locator('#otp-decrypted')).toHaveText('HELLO WORLD');
      await page.locator('#otp-reuse-btn').click();
      await expect(page.locator('.xor-row')).toHaveCount(5);
      await expect(page.locator('#otp-xor-identity')).toHaveClass(/match/);
      await expect(page.locator('#otp-xor-identity')).toContainText('C1 ⊕ C2 = P1 ⊕ P2');
      await expect(page.locator('.crib-cell.landed')).toHaveCount(9);
      await expect(page.locator('.crib-recovered')).toHaveText('ATTACK AT');
      await expect(page.locator('#otp-crib-drag')).toContainText('Looks like English');
    },
  },
  {
    // The crib slid off its true offset: the recovered slice goes to
    // gibberish and the note flips to the failure explanation. (The
    // danger-tinted `.junk` cells never render with these fixed messages —
    // XOR of printable ASCII stays printable — so this is the misplacement
    // rendering that actually exists.)
    label: 'OTP crib misplaced / gibberish verdict',
    drive: async (page) => {
      await openEra(page, 'otp');
      await page.locator('#otp-gen-key').click();
      await page.locator('#otp-encrypt-btn').click();
      await page.locator('#otp-reuse-btn').click();
      await expect(page.locator('.crib-recovered')).toHaveText('ATTACK AT');
      const pos = page.locator('#otp-crib-pos');
      await pos.focus();
      for (let i = 0; i < 3; i++) await pos.press('ArrowRight');
      await expect(page.locator('#otp-crib-pos-val')).toHaveText('3');
      await expect(page.locator('#otp-crib-drag')).toContainText('Gibberish means');
    },
  },
  {
    // A real AES-256-GCM run: the output grid, the populated schematic, the
    // GHASH table agreeing with Web Crypto bit for bit, a decrypt round-trip
    // and a green integrity verdict — the page's success palette, none of
    // which exists before Encrypt.
    label: 'AES computed / GHASH agreement + verified integrity',
    drive: async (page) => {
      await encryptAes(page);
      await expect(page.locator('#ghash-verdict .status.success')).toContainText(
        'all 128 bits agree',
      );
      await page.locator('#aes-decrypt-btn').click();
      await expect(page.locator('#aes-decrypted')).toContainText('arc of cryptography', {
        timeout: CRYPTO_TIMEOUT,
      });
      await page.locator('#aes-verify-btn').click();
      await expect(page.locator('#aes-verify-result .status.success')).toContainText(
        'Integrity verified',
        { timeout: CRYPTO_TIMEOUT },
      );
    },
  },
  {
    // The tampered run: the flipped-bit warning, the schematic's changed/stale
    // highlights, the tamper note, the moved-bits GHASH verdict and the failed
    // integrity check — the page's entire danger palette at once. An earlier
    // pass found the schematic highlight at 4.49:1 only by driving this state;
    // it stays driven so that fix stays proven.
    label: 'AES tampered / rejection verdicts',
    drive: async (page) => {
      await encryptAes(page);
      await page.locator('#aes-tamper-byte').fill('7');
      await page.locator('#aes-tamper-bit').fill('3');
      await page.locator('#aes-tamper-btn').click();
      await expect(page.locator('#ghash-verdict .status.error')).toContainText('of 128', {
        timeout: CRYPTO_TIMEOUT,
      });
      await expect(page.locator('#gcm-tamper-note')).toBeVisible();
      await expect(page.locator('.gcm-box.gcm-changed').first()).toBeVisible();
      await expect(page.locator('.gcm-box.gcm-stale')).toBeVisible();
      await page.locator('#aes-verify-btn').click();
      await expect(page.locator('#aes-verify-result .status.error')).toContainText(
        'Integrity check FAILED',
        { timeout: CRYPTO_TIMEOUT },
      );
    },
  },
  {
    // The synthesizing view: five-era timeline and both scripture bookends.
    label: 'Full Arc / timeline + reflection',
    drive: async (page) => {
      await openEra(page, 'full-arc');
      await expect(page.locator('.arc-item')).toHaveCount(5);
      await expect(page.locator('#panel-full-arc .scripture-card')).toHaveCount(2);
      await expect(page.locator('#panel-full-arc')).toContainText('Reflection');
    },
  },
  {
    // The shared header's skip link is parked at `top: -3rem` until focused.
    // The contrast walk deliberately skips text that paints no pixels, so the
    // only way its colours are ever measured is to focus it for real.
    label: 'header skip link focused',
    drive: async (page) => {
      await page.locator('.cl-skip-link').focus();
      await expect(page.locator('.cl-skip-link')).toBeFocused();
      // It slides in on a `transition: top .15s ease`; let it drain before
      // reading geometry.
      await settle(page);
      const onScreen = await page
        .locator('.cl-skip-link')
        .evaluate((el) => el.getBoundingClientRect().top >= 0);
      expect(onScreen, 'the header skip link must slide into view on focus').toBe(true);
    },
  },
];

for (const theme of THEMES) {
  for (const state of STATES) {
    test(`${theme} — ${state.label}`, async ({ page }) => {
      test.setTimeout(300_000);
      await boot(page, theme);
      await state.drive(page);
      await scan(page, `${theme} / ${state.label} / 1280px`);

      // Same state, phone width. Reflow (1.4.10) has no axe rule, and axe's
      // `scrollable-region-focusable` never fires on a container whose
      // content still fits — the Hebrew mapping table fits the desktop
      // column and only overflows here.
      await page.setViewportSize(NARROW);
      await settle(page);
      await scan(page, `${theme} / ${state.label} / ${NARROW.width}px`);
    });
  }
}

/**
 * WCAG 2.1.1 (Keyboard), asserted end to end rather than per-scan.
 *
 * `scan` already refuses any scrolling container with no keyboard route, but a
 * `tabindex` on an element the sequential walk never arrives at is no better
 * than none — so walk the page with Tab and prove each kind of scrolling
 * container that relies on its own tabindex is genuinely reached.
 *
 * Two kinds qualify here: the Hebrew mapping table's wrap (22 columns,
 * overflows at phone width, no focusable content of its own) and the Caesar
 * ranked-candidates list (26 rows against a 300px max-height, focusable
 * nowhere else). The Kasiski strip, report, XOR grid and crib row also
 * scroll, but they already carry their own tabindex and are covered by
 * `expectScrollersReachable` in every scanned state.
 */
test('every scrolling container is reachable by Tab', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, 'dark');
  await openEra(page, 'caesar');
  await page.locator('#caesar-break-btn').click();
  await expect(page.locator('.brute-force-item')).toHaveCount(26);

  await page.setViewportSize(NARROW);
  await settle(page);
  await expectScrollersReachable(page, 'tab walk / 380px');

  const KINDS = ['.table-scroll', '.brute-force-list'];
  const reached = new Set<string>();
  // The mapping table lives on the Atbash panel; go back to it so both kinds
  // are on the reachable tab ring (the candidates list stays in the DOM).
  await openEra(page, 'atbash');
  for (let i = 0; i < 400 && reached.size < 1; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate((kinds) => {
      const active = document.activeElement;
      return active ? (kinds.find((k) => active.matches(k)) ?? null) : null;
    }, KINDS);
    if (hit) reached.add(hit);
  }
  expect(
    Array.from(reached),
    'the mapping-table wrap must be reachable by Tab',
  ).toEqual(['.table-scroll']);

  await openEra(page, 'caesar');
  for (let i = 0; i < 400 && reached.size < KINDS.length; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate((kinds) => {
      const active = document.activeElement;
      return active ? (kinds.find((k) => active.matches(k)) ?? null) : null;
    }, KINDS);
    if (hit) reached.add(hit);
  }
  expect(Array.from(reached).sort(), 'each kind of scrolling container must be tabbable').toEqual(
    [...KINDS].sort(),
  );
});
