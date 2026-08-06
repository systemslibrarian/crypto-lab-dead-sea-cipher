import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { auditContrast, formatContrastFailures } from './contrast';

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A phone-width viewport, for the WCAG 1.4.10 reflow half of the gate. */
export const NARROW = { width: 380, height: 800 };

/**
 * Shared machinery for the WCAG gate.
 *
 * Three rules govern everything here:
 *
 *  1. NOTHING IS INJECTED INTO THE PAGE BEFORE A SCAN. The previous spec
 *     injected `.era-panel, .era-panel.active { display: block !important;
 *     opacity: 1 !important }` and force-activated every panel at once. The
 *     `opacity` clause does not suppress a check, it FABRICATES THE INPUT:
 *     partial opacity is real rendering, and forcing a partly-transparent
 *     element opaque hands axe a foreground colour the page never paints —
 *     every de-emphasis this page does through opacity (the revealed-key row
 *     of the XOR grid, the Kasiski spotlight dim, the crib strip's empty
 *     cells) was measured at full strength instead of as painted. It is
 *     deleted rather than replaced. The all-panels-at-once display override
 *     is gone too: it scanned a rendering no visitor can produce, and it let
 *     the gate skip the tab strip that is the page's actual navigation. Each
 *     panel is reached the way a visitor reaches it — by clicking its tab.
 *
 *  2. EVERY SCAN ASSERTS ITS CONTENT IS PRESENT FIRST, and there are scans
 *     well past first paint. axe over an empty container passes having
 *     checked nothing, and on this page the interesting containers start
 *     empty: no Break It has run so there are no ranked candidates, no
 *     Kasiski strip exists, the OTP XOR grid and crib row are unbuilt, and
 *     the GHASH table waits on a real encryption.
 *
 *  3. `violations` IS NOT THE WHOLE ORACLE. See `scan`.
 */

/**
 * Wait for every running animation and transition to drain.
 *
 * This page is why the fleet polls instead of injecting `transition: none`:
 * revealing panels here once put ~516 entries into `document.getAnimations()`
 * that took ~600ms to drain, while the light palette (built on `CanvasText`,
 * which Chromium re-resolves lazily after a `color-scheme` change) was still
 * half-swapped — axe sampled pairings like dark-theme text on a light-theme
 * card that no settled frame ever paints, on roughly half of runs.
 *
 * Transitions drain in waves, not in one batch, so a poll for "nothing running
 * right now" can exit through a gap between waves. Require quiescence to hold
 * for several consecutive frames instead. The 20s ceiling is deliberately
 * generous: on a loaded machine the raf cadence stretches, and the correct
 * response to that is a longer wait, never a narrower scan.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __quietFrames?: number };
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      w.__quietFrames = running.length === 0 ? (w.__quietFrames ?? 0) + 1 : 0;
      return w.__quietFrames >= 6;
    },
    undefined,
    { timeout: 20_000, polling: 'raf' },
  );
}

/**
 * Assert that reduced motion left the page visible, not merely un-animated.
 *
 * The failure mode this guards against is an element whose only route to its
 * visible state is an animation, in a stylesheet whose reduced-motion block
 * cancels that animation without restoring its end state — the element then
 * renders at `opacity: 0` for every reader with the preference set, and a
 * gate that injects `opacity: 1` paints it back for the scanner alone. This
 * stylesheet's reduced-motion block only shortens durations, which is the
 * safe half of the pattern — but that is a property of the stylesheet as it
 * stands rather than a guarantee, so it is asserted on every state.
 */
export async function expectNotBlank(page: Page, label: string): Promise<void> {
  const invisible = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      // Deliberately hidden subtrees are not "blank", they are closed.
      if (!(el as HTMLElement).checkVisibility?.({ checkVisibilityCSS: true })) continue;
      let effective = 1;
      let node: Element | null = el;
      while (node) {
        effective *= parseFloat(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      if (effective === 0) {
        out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}`);
      }
    }
    return Array.from(new Set(out));
  });
  expect(invisible, `no visible text may render at opacity 0 in state: ${label}`).toEqual([]);
}

/**
 * Load the page in a known theme with reduced motion actually in effect, and
 * assert the content every scan relies on is really on the page.
 *
 * `test.use({ reducedMotion })` silently does nothing on Playwright 1.61.1, so
 * the emulation is applied imperatively and then *asserted* from inside the
 * page. It decides more than transition durations here: the Caesar alignment
 * slide and the GCM tamper cascade both branch on
 * `matchMedia('(prefers-reduced-motion: reduce)')` in JS, so the emulation
 * picks which of two renderings is under test.
 *
 * The theme is chosen the way a returning visitor's is — through the
 * `localStorage` key the inline <head> script reads before first paint — and
 * then asserted, rather than toggled after load. Loading directly into the
 * light theme also means its `CanvasText`-derived palette resolves once, at
 * load, instead of racing a `color-scheme` swap (see `settle`).
 */
export async function boot(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (theme === 'light') {
    await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  }
  await page.goto('.');
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation must actually be in effect',
  ).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

  // The whole lab is injected by JS into an empty #app. Assert the structure
  // every scan relies on is really there, so no scan can pass over a shell.
  await expect(page.locator('.cl-hero-title')).toHaveText('Dead Sea Cipher');
  await expect(page.locator('.timeline-nav button')).toHaveCount(6);
  await expect(page.locator('#panel-atbash')).toHaveClass(/active/);
  await expect(page.locator('#atbash-output')).toHaveText('YZYVO');
  await expect(page.locator('#panel-atbash .scripture-card')).toHaveCount(3);
  await expect(page.locator('#atbash-hebrew-table .hebrew-cell')).toHaveCount(44);

  await settle(page);
  await expectNotBlank(page, `${theme} first paint`);
}

/** Click an era tab and wait for its panel, the way a visitor changes era. */
export async function openEra(page: Page, era: string): Promise<void> {
  await page.locator(`#tab-${era}`).click();
  await expect(page.locator(`#panel-${era}`)).toHaveClass(/active/);
  await expect(page.locator(`#tab-${era}`)).toHaveAttribute('aria-selected', 'true');
}

/**
 * Assert the page does not require horizontal scrolling.
 *
 * WCAG 1.4.10 (Reflow, AA). axe has no rule for this at all, and this page is
 * a plausible offender: a 22-column Hebrew table, a per-character Kasiski
 * strip, a byte-per-column XOR grid and a crib row, several of them
 * `min-width: max-content`. Each is supposed to live inside its own
 * `overflow-x: auto` container — a container missed, or a long string outside
 * one, pushes the document sideways at 380px.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth) return null;
    const widest = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.right > doc.clientWidth + 1)
      .sort((a, b) => b.r.right - a.r.right)[0];
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: widest
        ? `${widest.el.tagName.toLowerCase()}${widest.el.id ? '#' + widest.el.id : ''}` +
          `${widest.el.getAttribute('class') ? '.' + widest.el.getAttribute('class')!.trim().split(/\s+/).join('.') : ''}` +
          ` @${Math.round(widest.r.width)}px right=${Math.round(widest.r.right)}`
        : '(none identified)',
    };
  });
  expect(overflow, `page must not scroll horizontally in state: ${label}`).toBeNull();
}

/**
 * Every scrolling container must be operable from the keyboard (WCAG 2.1.1).
 * If it holds no focusable content it needs a keyboard route of its own, so
 * it becomes a focus target arrow keys can then scroll.
 *
 * axe's own `scrollable-region-focusable` covers this, but only where the
 * content actually overflows *in the scanned state and viewport* — the Hebrew
 * mapping table fits the desktop column and only overflows at phone width,
 * and the ranked-candidates list does not exist until Break It has run. This
 * assertion runs alongside the axe rule because it names the element and its
 * measurements, which the rule's node target does not.
 */
export async function expectScrollersReachable(page: Page, label: string): Promise<void> {
  const unreachable = await page.evaluate(() => {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)
        );
      })
      .filter((el) => el.tabIndex < 0 && !el.querySelector(FOCUSABLE))
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}` +
          ` (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`,
      );
  });
  expect(
    Array.from(new Set(unreachable)),
    `scrolling regions with no keyboard route in state: ${label}`,
  ).toEqual([]);
}

/**
 * Scan the page as it currently stands.
 *
 * Five assertions, because axe's `violations` array alone is not a complete
 * oracle:
 *
 *  - `violations` — the usual WCAG A/AA rule failures.
 *  - `incomplete` — axe's "could not decide" bucket, which never reaches the
 *    violations array. The one rule id allowed to remain incomplete is
 *    `color-contrast`, and only because the next assertion computes those
 *    ratios arithmetically (axe declines on this page's gradient meter track
 *    and color-mix tints). Everything else in the bucket — ARIA-prohibited
 *    names hide there — must be empty.
 *  - arithmetic contrast — composite-aware WCAG 1.4.3 over every text node,
 *    measured against the surface the text is genuinely painted on, at the
 *    opacity it is genuinely painted at.
 *  - keyboard reachability of scrolling regions — WCAG 2.1.1.
 *  - reflow — WCAG 1.4.10, which axe has no rule for at all.
 */
export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  await expectNotBlank(page, label);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const violations = results.violations.map((v) => ({
    state: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  expect(violations, `axe violations in state: ${label}`).toEqual([]);

  const unexplainedIncomplete = results.incomplete
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({
      state: label,
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
    }));
  expect(unexplainedIncomplete, `axe incomplete results in state: ${label}`).toEqual([]);

  // Deduplicated: a single stylesheet mistake repeats across every character
  // cell of the Kasiski strip, and an assertion diff that long is unreadable.
  const contrast = Array.from(new Set(formatContrastFailures(await auditContrast(page))));
  expect(contrast, `measured contrast failures in state: ${label}`).toEqual([]);

  await expectScrollersReachable(page, label);
  await expectNoHorizontalOverflow(page, label);
}
