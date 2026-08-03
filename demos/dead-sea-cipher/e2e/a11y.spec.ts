import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * WCAG regression gate. Scans the full page in both themes with every
 * collapsible region revealed. This lab uses class-toggled tab panels
 * (.era-panel + .active, display:none when inactive) rather than <details>,
 * so we reveal all of them (plus any <details>, just in case) before scanning.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Settle transitions through the real media query the stylesheet already
 * honours, rather than by injecting test-only CSS: what axe measures is then a
 * state the page can genuinely be in for a user who asked for reduced motion.
 *
 * This is `page.emulateMedia`, not `test.use({ reducedMotion: 'reduce' })`,
 * because on this Playwright version the `test.use` form silently did not take
 * effect here — `matchMedia('(prefers-reduced-motion: reduce)')` stayed false
 * and the tab transitions kept their 0.2s duration, so axe could sample the
 * page mid-fade and report contrast failures that no settled state has. The
 * assertion below makes that failure loud instead of silent.
 */
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('.');
  const reduced = await page.evaluate(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  expect(reduced, 'reduced-motion emulation did not take effect').toBe(true);
});

/** Web Crypto PBKDF2 at 200k iterations is slow; the AES scans need headroom. */
const CRYPTO_TIMEOUT = 30_000;

async function revealAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Expand any native disclosure widgets.
    for (const details of document.querySelectorAll('details')) {
      (details as HTMLDetailsElement).open = true;
    }
    // Panel visibility is a class toggle, not a transition, so this override
    // still has to be injected: reveal every era panel so hidden content is
    // scanned. Motion is handled by reducedMotion above.
    const style = document.createElement('style');
    style.textContent =
      '.era-panel, .era-panel.active { display: block !important; opacity: 1 !important; }';
    document.head.appendChild(style);
    for (const panel of document.querySelectorAll('.era-panel')) {
      panel.classList.add('active');
      panel.removeAttribute('hidden');
    }
  });
}

/**
 * The GHASH table, the tamper verdict and the failure statuses are painted
 * asynchronously — PBKDF2 alone takes hundreds of milliseconds. A scan that
 * runs straight after `goto` reaches none of them and passes having checked an
 * empty container, so this drives the AES panel to its computed states first
 * and waits for the real content before handing the page to axe.
 */
async function paintComputedAesState(page: Page): Promise<void> {
  await page.locator('#tab-aes').click();
  await page.locator('#aes-encrypt-btn').click();
  await expect(page.locator('#gcm-ghash-panel')).toBeVisible({ timeout: CRYPTO_TIMEOUT });
  await expect(page.locator('#ghash-verdict .status')).toBeVisible({ timeout: CRYPTO_TIMEOUT });

  await page.locator('#aes-tamper-byte').fill('7');
  await page.locator('#aes-tamper-bit').fill('3');
  await page.locator('#aes-tamper-btn').click();
  await expect(page.locator('#ghash-verdict .status.error')).toContainText('of 128', {
    timeout: CRYPTO_TIMEOUT,
  });
  await expect(page.locator('#gcm-tamper-note')).toBeVisible();

  await page.locator('#aes-verify-btn').click();
  await expect(page.locator('#aes-verify-result .status.error')).toContainText(
    'Integrity check FAILED',
    { timeout: CRYPTO_TIMEOUT },
  );
}

async function scan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

test('no WCAG A/AA violations in dark theme', async ({ page }) => {
  await revealAll(page);
  await scan(page);
});

test('no WCAG A/AA violations in light theme', async ({ page }) => {
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await revealAll(page);
  await scan(page);
});

test('no WCAG A/AA violations once the AES panel has computed its results (dark)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await paintComputedAesState(page);
  await revealAll(page);
  await scan(page);
});

test('no WCAG A/AA violations once the AES panel has computed its results (light)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await paintComputedAesState(page);
  await revealAll(page);
  await scan(page);
});
