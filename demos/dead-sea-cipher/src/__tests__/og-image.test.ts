/* The dates on the social-preview card.
 *
 * The rest of the lab was corrected to "AES 2001, GCM 2007" — FIPS 197
 * standardized AES in November 2001, and GCM arrived with NIST SP 800-38D in
 * November 2007 — but public/og-image.svg still read "AES-256-GCM · 2001 CE",
 * dating the whole construction to 2001. The PNG rendered from that SVG is what
 * people see when the link is shared, so the card carried the old claim
 * outwards long after the page stopped making it.
 *
 * The SVG is the source; public/og-image.png is rendered from it at 1200x630.
 * This reads the SVG as text (no node:fs here — the lab has no @types/node and
 * `tsc` covers src/), so an edit to the card that reintroduces the single date
 * fails the suite.
 */
import { describe, expect, it } from 'vitest';

import svg from '../../public/og-image.svg?raw';

describe('the social-preview card', () => {
  it('dates AES and GCM separately, as the rest of the lab does', () => {
    expect(svg).toContain('AES 2001, GCM 2007');
    expect(svg).not.toContain('AES-256-GCM · 2001 CE');
    expect(svg).not.toMatch(/AES-256-GCM[^<]*\b2001 CE/);
  });

  it('keeps the arc it advertises, and the card geometry', () => {
    expect(svg).toContain('ATBASH');
    expect(svg).toContain('~600 BCE');
    expect(svg).toContain('width="1200" height="630"');
  });
});
