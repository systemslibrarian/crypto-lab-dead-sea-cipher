# Extension brief — `crypto-lab-dead-sea-cipher` (affine cipher)

**2026-10-21. Extension to a live lab; no new repository.** Written against
`crypto-lab-dead-sea-cipher` at `3779099996b7` and `audits/_MASTER-TEMPLATE.md` (catalog
`88f75e7edc6f`). Template §5: "Extend, never restructure."

- **The app lives in `demos/dead-sea-cipher/`.** Every source path below is relative to it.
  The two READMEs are named in full.
- Save this file at the repo root as `brief-extension-affine.md`. Write your handoff to
  `extension-handoff-affine.md` beside it.

Source of the gap: Paar & Pelzl, *Understanding Cryptography* (1st ed., 2010), §1.4.4, checked
against the book's text:

- the encryption and decryption rules;
- gcd(a, 26) = 1;
- the 12 admissible values of a;
- the key space 12 × 26 = 312;
- the statement that the cipher remains open to brute force and frequency analysis.

It is also the draft gap check's residual rank 9 (`draft/understanding-cryptography-2e`).

**Verdict: extension — one new card inside the Caesar panel**, "Generalising the shift: the
affine cipher", after "Break It — Frequency Alignment" and before "Fatal Flaw". **Not** a new
era tab. The affine cipher has no historical era of its own in this lab's timeline, and every
era is sourced in `SOURCES.md`.

## What the lab has now

Read at `3779099996b7`:

- **Six era tabs**, built in `src/main.ts:23–65`: Atbash, Caesar, Vigenère, OTP, AES and Full
  Arc. The Caesar panel is `buildCaesarPanel()` (`src/main.ts:257`), and its behaviour is
  `initCaesar()` (`:371`).
- **Ciphers** live in `src/ciphers/`; `caesar.ts` preserves case and passes non-letters
  through. **Analysis** lives in `src/analysis/`: `frequency.ts` has `chiSquaredFitness`,
  `indexOfCoincidence` and `ENGLISH_FREQUENCIES`, and `caesar-crack.ts` ranks shifts by χ².
- **Default texts:** `src/content/scripture.ts`, including the closing 1 Corinthians 10:31.
- **Tests:**
  - Vitest in `src/__tests__/ciphers.test.ts`, with the Caesar KATs at `:48–70`.
  - `e2e/claims.spec.ts`, with the Caesar break claims at `:117` and `:172`.
  - **The Caesar a11y scan states are in `e2e/a11y.spec.ts:75–82`.** `e2e/gate.ts`'s `boot()`
    enumerates nothing for Caesar.
  - `package.json` scripts: `test`, `test:a11y`, `test:claims`.
  - **There is no mutation script and no `data-verdict` marker** at this commit.
  - **The lab has no `<select>` element yet.** This card would add the first ones, so author
    them to §4.2 from the start: `appearance: none` with a custom chevron, and a ≥ 3:1 control
    boundary. `e2e/nontext-baseline.ts` is shrink-only, so **never add an entry to it**.
- **READMEs:** the root `README.md` (What It Is, Live Demo, What Can Go Wrong, …) and
  `demos/dead-sea-cipher/README.md`, whose `## Exhibits` at `:9` is numbered by era.
  `SOURCES.md` is the per-claim source file.

**Overlap check.** Grep every sibling clone you have for `affine` and `a\s*\*\s*x\s*\+\s*b`. At
brief time the brief author had no Vigenère Break or Enigma Forge clone, so open those two
from source before building.

## The key count (decide before writing copy)

The lab already disagrees with itself on Caesar's key count.

- **"25"** appears in:
  - `src/ciphers/caesar.ts:4` ("only 25 possible shifts");
  - `src/analysis/caesar-crack.ts:3`;
  - `src/content/scripture.ts:58` ("25 possible keys instead of 1"), `:65` (the Fatal Flaw
    shown directly below this card: "only 25 possible keys") and `:110`;
  - `demos/dead-sea-cipher/README.md` Exhibits item 2 ("ranks all 25 shifts").
- **"26"** is what the UI does: `caesarBruteForce` returns 26 rows, and `src/main.ts:311`'s
  aria-label reads "All 26 candidate shifts". `e2e/a11y.spec.ts:80` asserts 26 rows.

The affine card sits right above that Fatal Flaw, so its count must match.

- Counting the identity: Caesar has 26 keys and affine has **312**.
- Not counting it: 25 and **311**.

**Ask Paul which convention to use. If you can't ask, use "312 keys, one of which leaves the
text unchanged".** Do not edit the existing "25" sites in this extension. List them in the
handoff for Paul.

## What to add — the affine card

**Plain-language intro.** "Caesar adds a fixed number to every letter. The affine cipher
first **multiplies** by a key number a, then adds b. Multiplying only works if you can undo it,
and on a 26-letter clock you can't always: multiply by 2 and two different letters land on the
same one. So only 12 values of a are allowed. That gives 312 keys — and the cipher still falls
to the same frequency attack."

**Five short steps, each computed live:**

1. **Encrypt** y = a·x + b (mod 26), with a selector for **every** a in 1…25 and b in 0…25.
   Case and non-letters behave as in `caesar.ts`.
   - Default: a = 7, b = 3 over the 1 Corinthians 10:31 verse from `scripture.ts` (60
     letters).
   - **Two famous members, one click each:** a = 1 is Caesar, and **a = 25, b = 25 is Atbash**
     (x ↦ 25 − x ≡ 25x + 25). Both are verified against this lab's own `caesar.ts` and
     `atbash.ts`, which ties the card back to the first era.
2. **Undo it — or fail to.**
   - x = a⁻¹(y − b), with a⁻¹ found by trying candidates and shown with a·a⁻¹ ≡ 1 (mod 26).
   - **Break it:** with gcd(a, 26) > 1 the page shows the collision. a = 2 sends both A and N
     to the same letter and has only 13 distinct outputs; a = 13 has 2. "Not decryptable:
     this key destroys information."
   - Compute the 12 admissible values; never type them.
3. **Try every key.**
   - Rank all admissible (a, b) by `chiSquaredFitness`, reusing the lab's function rather
     than a copy.
   - **Render every row** in a labelled scroll region, as the Caesar list at
     `src/main.ts:309–311` does, and highlight the top three.
   - On the default verse the true key ranks first.
4. **Two letters are usually enough.**
   - From two known plaintext→ciphertext pairs (x₁ → y₁, x₂ → y₂), solve
     a = (y₁ − y₂)(x₁ − x₂)⁻¹ and b = y₁ − a·x₁ (mod 26).
   - **This is fail-closed in two separate ways:**
     - **(i)** x₁ − x₂ is even or 13, so it has no inverse mod 26 and the pair can't fix a.
       The page says "add another pair".
     - **(ii)** x₁ − x₂ is invertible, but the solved a is **not admissible** because
       gcd(y₁ − y₂, 26) > 1. Then **no affine key produces these two pairs**, and the page
       must say so — never "key found". Example: D→Y with E→A solves to a = 2, which is not a
       key. A→C with B→C solves to a = 0.
     - The brief author's reviewer counted it: of the 210,912 four-letter tuples with an
       invertible x-difference, 113,568 have no valid key. This is the common case, not a
       corner.
   - An optional **third pair** input confirms a solved key: "this key does / doesn't explain
     your third letter".
5. **Same leak as Caesar.** The ciphertext's IC equals the plaintext's under every key,
   because the mapping is still one fixed letter for one fixed letter. Reuse the Atbash/Caesar
   IC display.

## SECURITY / CORRECTNESS INVARIANTS

1. **Derive the admissible set:** `validA = [1..25].filter(a => gcd(a, 26) === 1)`. The 12
   and the 312 are never hard-coded.
2. **Verify every displayed inverse:** show a · a⁻¹ mod 26 = 1 beside it.
3. **A key is reported only if it is admissible.** This applies to every route that outputs
   a key — selector, brute force and the two-pair solver. An inadmissible a disables
   decryption, and the solver returns a typed `NoAffineKey`.
4. **Reuse `chiSquaredFitness`** from `analysis/frequency.ts`. One fitness function means
   Caesar's and the affine card's rankings cannot drift.
5. **Case and punctuation follow `caesar.ts`**, asserted by one shared test.

## ARCHITECTURE

- `src/ciphers/affine.ts` — `affineEncrypt(text, a, b)`, `affineDecrypt(text, a, b)`,
  `validA()`, `inverseMod26(a)` (returns `number | null`), `collisions(a)`.
- `src/analysis/affine-crack.ts`:
  - `crackAffine(ciphertext)` ranks all admissible keys;
  - `solveFromPairs(x1, y1, x2, y2)` returns `{ a, b }`, or `{ kind: 'NotInvertible', diff }`,
    or `{ kind: 'NoAffineKey', a }`;
  - `confirmPair(key, x3, y3)`.
- `src/main.ts`:
  - a `buildAffineCard()` string, inserted in `buildCaesarPanel()` before the Fatal Flaw
    card;
  - `initAffine()`, called in `buildApp()` right after `initCaesar()`.
  - Touch nothing else.
- `src/__tests__/affine.test.ts`.
- `scripts/check-affine-mutations.mjs`, with `mutation-evidence-affine.json` written by the
  script. Copy the shape of `crypto-lab-aes-modes/scripts/check-ofb-mutations.mjs`. This card
  renders verdicts, so §4.1c's script requirement applies.
- Verdict elements carry `data-verdict` and a class, as AES Modes' OFB verdict does
  (`crypto-lab-aes-modes/e2e/claims.spec.ts:72`), so the claims can assert both.
- `// [extension] point` in `affine.ts` for an affine cipher mod m: the 22-letter Hebrew
  alphabet beside the lab's Hebrew Atbash. Not built.

## UI

- Selects for a (1–25) and b (0–25). Inadmissible a values stay selectable; their option text
  says "(not invertible)", rather than relying on colour.
- Presets: "Caesar (a = 1)" and "Atbash (a = 25, b = 25)".
- I/O in the panel's `.cipher-io` pattern.
- "Try every key" opens the full ranked list.
- Two-pair solver: four letter inputs, plus an optional third pair (two inputs).
- Predict prompt: "Multiplying adds how many keys — 25 × 26, or fewer?"
- `role="status"` and `aria-live="polite"` on outputs. Stacks below 640px.

## VISUAL SEMANTICS

- **A key recovered** by brute force or by two pairs is ALARM, `data-verdict="recovered"`:
  "⚠ key found: a = 7, b = 3".
- **An inadmissible a, `NotInvertible` and `NoAffineKey`** are informational, not alarms. Each
  is the correct answer to the question asked:
  - "ⓘ a = 2 is not invertible mod 26 — A and N collide";
  - "ⓘ no affine key maps D→Y and E→A".
- **The §4.1d fixture** reads `VALID KEY — AND RECOVERED BY FREQUENCY` (see below).
- Never a green success chip on a recovered key. Icon plus text plus colour; check in
  grayscale.

## EDGE CASES

- **Short ciphertext.** The χ² ranking can mislead. On the 14-letter "DEAD SEA SCROLLS", the
  true key ranks **2nd**. Show the letter count beside the ranking with "short texts mislead
  the statistics", and label the top row "most likely", not "found", below ~40 letters.
  - **Note:** the rank of the true key does not depend on which key was used. Affine maps
    form a group, so decrypting E_k(P) under all 312 keys gives the same candidate set for
    every k. Tests must vary the **text**, not the key.
- No letters at all → refuse the ranking ("nothing to measure").
- Two-pair solver given the same plaintext letter twice → difference 0 → `NotInvertible`.
- A third pair that the solved key does not explain → "this key doesn't explain your third
  letter", informational.
- Changing a, b or the text retires the ranking and the solver result, and says so.
  Re-selecting the same value is a no-op.

## EXTENSION SEAMS

1. An affine cipher over the 22-letter Hebrew alphabet beside the lab's Hebrew Atbash. A source
   is needed for any historical claim. Not built.
2. The Hill cipher as the matrix generalisation. Paar's 1st edition does not cover it, so it
   needs its own source. Not built.

## Acceptance checks

These expected values are arithmetic facts. The brief author and an independent reviewer
verified them by separate computations. No external vector source exists for this cipher, so
say that in the README rather than crediting a document.

| Check | Expected |
|---|---|
| admissible a | 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25 (12); 12 × 26 = 312 keys |
| inverses mod 26 | 1↔1, 3↔9, 5↔21, 7↔15, 11↔19, 17↔23, 25↔25 |
| (7, 3) on "DEAD SEA SCROLLS" | "YFDY ZFD ZRSXCCZ" |
| (11, 20) on "In the beginning" | "Eh vtm fmiehhehi" (case preserved) |
| affine(25, 25) | equals this lab's Atbash on all 26 letters |
| affine(1, k) | equals this lab's Caesar shift k for all k |
| a = 2, b = 0 | A, N → A; B, O → C; 13 distinct outputs. a = 13: 2 outputs |
| pairs D→Y, E→F | (7, 3) |
| pairs E→?, A→? (x-difference 4) | `NotInvertible` |
| pairs D→Y, E→A | `NoAffineKey` (solves to a = 2) |
| pairs A→C, B→C | `NoAffineKey` (solves to a = 0) |
| default verse (60 letters), any key | true key ranks 1st |
| "DEAD SEA SCROLLS" (14 letters), any key | true key ranks 2nd |

**Unit (`src/__tests__/affine.test.ts`):**

- every row above;
- decrypt∘encrypt = identity for all 312 keys over the full alphabet;
- `collisions(a)` is empty exactly for the admissible a;
- **`solveFromPairs` against brute force over all 26⁴ (x₁, y₁, x₂, y₂) tuples**:
  - it returns `{a, b}` exactly when some admissible key maps both pairs, and returns that
    key;
  - otherwise it returns `NotInvertible` or `NoAffineKey`, as appropriate.
  - Do this rather than testing only key-generated pairs, which cannot catch rule (ii).

**Claims (`e2e/claims.spec.ts`, §4.1b):**

- Recompute the displayed ciphertext from the displayed a, b and plaintext using the test's
  own arithmetic.
- Assert that the displayed a·a⁻¹ mod 26 is 1.
- Count the rows of the full ranked list and assert 312 = 12 × 26, with the gcd recomputed in
  the test.
- For the two-pair verdict, substitute the solved (a, b) into both pairs on screen. For a
  `NoAffineKey` state, assert that the page names no key.
- Every recovered-key state asserts `data-verdict="recovered"` **and** the alarm class.
- Retirement and the no-op guard.

**§4.1c mutations.** These break the arithmetic, never a flag. Record them as concrete patches
(file, unique anchor, replacement) in `scripts/check-affine-mutations.mjs`.

1. `validA` tests `gcd(a, 13) === 1`, which admits even a → the admissible-set unit test and
   the 312-row claim fail.
2. Decryption multiplies by a instead of a⁻¹ → the round trip fails for every a other than 1
   and 25.
3. Decryption computes a⁻¹·y − b instead of a⁻¹·(y − b) → the round trip fails.
4. `crackAffine` iterates only a = 1, silently becoming Caesar → the 312-row claim fails.
5. `solveFromPairs` drops the admissibility check on the solved a (rule ii) → the D→Y/E→A
   test fails, because the code returns a = 2. Anchor the patch on that check's own line, not
   on `inverseMod26`.
6. The recovered-key element gets the neutral class and verdict → the class and
   `data-verdict` assertions fail.
7. Delete the negative-claim sentence → §4.1d assertion 3 fails.

**§4.1d negative claim:** *"Multiplying first raises the number of keys to 312, but adds no
security: the affine cipher is still one fixed letter for one fixed letter, so the frequency
attack that breaks Caesar breaks it."* Match the 312/311 wording to the count Paul picked.

- **Fixture:** the default, (7, 3) on the verse. Every check the card renders passes:
  - a is admissible ✓;
  - a·a⁻¹ ≡ 1 ✓;
  - the round trip holds ✓.
- **And the key is recovered** by the ranking. The verdict reads `VALID KEY — AND RECOVERED BY
  FREQUENCY`, with `data-verdict` and the alarm class, and the sentence is visible.
- Assert all three §4.1d points. Breaking the admissibility check inside the fixture must fail
  assertion 2. Deleting the sentence must fail assertion 3.

**A11y.** Add the card's states to `e2e/a11y.spec.ts` after the Caesar states (`:75–82`):

- card open;
- an inadmissible a;
- the full ranking;
- a two-pair `NoAffineKey`;
- the §4.1d fixture.

Run each at 1280 px and 320 px.

**Fail-closed paths, each a NAMED test:**

- an inadmissible a refusing decryption;
- a zero-difference pair;
- a non-invertible difference;
- `NoAffineKey`;
- no letters;
- a short text labelled "most likely";
- a third pair that doesn't fit;
- a key change retiring the ranking.

## README and card follow-up

- `demos/dead-sea-cipher/README.md`, Exhibits item 2: add one sentence on the affine
  generalisation, its key count, and the Atbash and Caesar special cases. Don't renumber.
- Root `README.md`, What It Is: one clause naming the affine cipher. Then update
  Build/verification wherever the root README lists tests.
- `SOURCES.md`: an "Affine cipher" entry citing Paar & Pelzl §1.4.4 for the key-space
  arithmetic. Make no historical-use claim unless you source one.
- **Catalog handoff** (do not edit `../crypto-lab`):
  - `tools/catalog-vocab.js` has no `Affine` term, and none for Atbash either.
  - So an `Affine` chip would be neither credited nor judged until the catalog pass adds a
    term. Propose it there.
- **For Paul:** the 25-versus-26 sites listed in *The key count*.

## Do not touch

The other era panels, the GHASH exhibit, the hero copy, `scripture.ts` content (reuse it, don't
edit it), the existing "25" sites, the header and the footer.

## Sources

- Paar & Pelzl, *Understanding Cryptography* (1st ed., 2010), §1.4.4 — Definition 1.4.4,
  Eq. (1.2), and the 312-key computation, checked by the brief author. Reproduce none of the
  book's examples; the vectors above are original.
- This lab's own `atbash.ts` and `caesar.ts`, as the equality references for the two special
  cases.
