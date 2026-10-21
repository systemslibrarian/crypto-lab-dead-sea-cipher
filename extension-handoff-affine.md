# Affine extension handoff

Read `brief-extension-affine.md` and the supplied master template. Extended the existing Caesar panel without changing its neighbouring era panels, header, footer, scripture text or historical “25” sites.

- Starting main: `3779099996b70fe0040789e96f9783856851f6ab`.
- Verification: 58 Vitest tests + 2 publishing-command tests; 36 Chromium browser tests; 8/8 scripted mutations killed, exact built artifact restored after each. Evidence: `mutation-evidence-affine.json`.
- Browser verification used the available Chromium executable because the Playwright CDN download returned an invalid ZIP. The committed CI gate retains the repository's normal browser installation and full test suite.
- New scan states: valid, inadmissible, all 312 ranked candidates, impossible pairs and the negative fixture, at 1280px and 320px. No baseline entries added.
- Overlap source review: Vigenère Break `7e674ebfaadf0681a6dff77ab16ffc2885b46013`, Enigma Forge `418d56def1808f38cc10eab23c0fb0e446c90001`; neither implements this affine experiment. Existing Atbash, Caesar, frequency analysis and scripture modules were read and reused.
- Count convention: 312 keys including the identity, explicitly distinguished from 311 nonidentity transformations. Existing Caesar “25” statements remain at `src/ciphers/caesar.ts`, `src/analysis/caesar-crack.ts`, `src/content/scripture.ts`, and the nested README. The new card explains the counting convention beside its computed count.
- Brief correction: the exhaustive solver requirement cannot literally return a unique key whenever any valid key exists: noninvertible differences can have several solutions. The test enumerates all 26⁴ tuples against independently enumerated admissible keys, demands a unique key for invertible differences, and demands `NotInvertible` for ambiguous differences. Invalid solved multipliers return `NoAffineKey`.
- Negative claim: successful admissibility, inverse and round-trip checks coexist with frequency recovery. Frequency ranking is labelled statistical; short text is never called proven recovery.
- Catalog proposal: add an Affine vocabulary term; implementation `demos/dead-sea-cipher/src/ciphers/affine.ts` (`affineEncrypt`, `affineDecrypt`), key recovery in `src/analysis/affine-crack.ts`. Do not credit Atbash or Caesar from comments alone; existing implementation anchors remain available.
- Playwright port remains 4223. Grouping, auto-merge, PR gate and workflow_dispatch already present and preserved.
