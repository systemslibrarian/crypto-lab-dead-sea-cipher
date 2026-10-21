# Affine extension handoff

Read `brief-extension-affine.md` and the supplied master template. Extended the existing Caesar panel without changing its neighbouring era panels, header, footer, scripture text or historical “25” sites.

- Original extension start: `3779099996b70fe0040789e96f9783856851f6ab`. This correction starts at `e8c8c07` on `fix/affine-exact-solver-claims`; PR only, no merge or deployment.
- Verification: 63/63 Vitest tests (17 affine + 46 existing cipher tests), 2/2 node:test publishing-command tests, and 67/67 Playwright tests (17 accessibility + 50 claims) passed; zero failed, skipped or flaky tests. `npm ci` and the production build also passed. The solver is checked against independent brute force for all 456,976 two-pair tuples and 2,000 seeded three-pair tuples. Mutation evidence is generated only by `scripts/check-affine-mutations.mjs` in `mutation-evidence-affine.json`.
- Local browser verification uses Chromium 153.0.8010.0 through an ignored config because the Playwright Chromium 156 download returned invalid ZIP archives. The override changes only the executable/launch arguments; the committed configuration, build-before-preview, strict port, all specs and accessibility oracles are preserved. Local verification disables retries so failures cannot be hidden as flakes.
- The five affine scan states are in `e2e/a11y.spec.ts`, immediately after Caesar broken: card open, a = 2 inadmissible, full 312-row ranking, D→Y/E→A with no key, and the §4.1d fixture. Their setup asserts structure and each is scanned at 1280px, the existing 380px, and 320px. Every affine claim is in `e2e/claims.spec.ts`; the old combined `e2e/affine.spec.ts` is removed. No baseline entries added; `e2e/gate.ts` is unchanged.
- Overlap source review: Vigenère Break `7e674ebfaadf0681a6dff77ab16ffc2885b46013`, Enigma Forge `418d56def1808f38cc10eab23c0fb0e446c90001`; neither implements this affine experiment. Existing Atbash, Caesar, frequency analysis and scripture modules were read and reused.
- Count convention: the 25-versus-26 question went unanswered, so the brief's fallback, “312 keys, one of which leaves the text unchanged”, was used. The card now identifies (a = 1, b = 0), explains why the Fatal Flaw counts 25 Caesar keys, and computes 312 − 1 = 311 for the same identity-excluding affine convention. No existing “25” site was edited.
- Corrected solver rule (supersedes brief step 4(i)): filter every admissible key against every filled pair. Exactly one match returns that key, zero returns typed `NoAffineKey`, and several returns typed `SeveralKeys { count }`. An invertible plaintext difference permits the displayed inverse formula; a nonzero even difference other than 13 permits at most one admissible key because its two roots modulo 26 have opposite parity. Several matches are possible only when every pairwise plaintext difference is 0 or 13. A third pair participates in the same filtering, so it can resolve ambiguity or reject a previously unique key. Across all 26⁴ tuples the totals are **194,688 one key / 260,936 none / 1,352 several**. There is no `NotInvertible` result type in the implementation.
- Negative claim: the unchanged 60-letter (7, 3) fixture asserts every rendered check passes, the recovery is an alarm, and the entire computed-count limitation sentence is visible. Under 40 letters, even a matching top key is only `most-likely`, never “RECOVERED” or “VALID KEY”; nonmatching short text remains an informational candidate.
- Catalog proposal: add an Affine vocabulary term; implementation `demos/dead-sea-cipher/src/ciphers/affine.ts` (`affineEncrypt`, `affineDecrypt`), key recovery in `src/analysis/affine-crack.ts`. Do not credit Atbash or Caesar from comments alone; existing implementation anchors remain available.
- Playwright port remains 4223. Grouping, auto-merge, PR gate and workflow_dispatch already present and preserved.

## Existing “25” sites (unchanged)

Source paths below are relative to `demos/dead-sea-cipher/`.

| File | Line | Existing statement |
| --- | ---: | --- |
| `src/ciphers/caesar.ts` | 4 | only 25 possible shifts |
| `src/analysis/caesar-crack.ts` | 3 | all 25 possible shifts |
| `src/content/scripture.ts` | 58 | 25 possible keys instead of 1 |
| `src/content/scripture.ts` | 65 | only 25 possible keys (Fatal Flaw) |
| `src/content/scripture.ts` | 110 | Only 25 possible shifts |
| `README.md` (nested demo, Exhibits item 2) | 12 | ranks all 25 shifts |

## Mutation coverage

The original seven targets remain, adapted to the exact solver and formatted source:
admissible modulus, inverse multiplier, inverse offset, Caesar-only ranking,
inadmissible solved key, calm recovery (both class and verdict), and missing negative
claim (the entire sentence). All browser owners now live in `e2e/claims.spec.ts`.

Seven targets go beyond the brief's seven:

- **broken fixture check** — shrink `validA`'s arithmetic enumeration from 25 to 6 candidates; the negative-claim test must fail at “every check passes”.
- **solver displays b plus one** — the printed key fails independent substitution into the page's pairs.
- **pair-change retirement disabled** — the stale solver result remains.
- **short-text guard removed** — the 14-letter matching top key incorrectly reads recovered.
- **third-pair filter skipped** — an inconsistent third letter is wrongly accepted.
- **inadmissible ranking guard removed** — a = 2 is wrongly ranked as decryptable.
- **SeveralKeys reported as first key** — ambiguous pairs wrongly name a unique key.

The script's kill rules, baseline-owner checks, changed-bundle requirement,
byte-for-byte restoration, restored hash and restored-owner checks are unchanged.
Real changes are committed before any mutation is run. Mutation records are never
hand-edited.
