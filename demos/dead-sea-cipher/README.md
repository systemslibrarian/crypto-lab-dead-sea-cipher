# Dead Sea Cipher

## What It Is

Dead Sea Cipher is a browser-based interactive demo covering five eras of cryptographic history: Atbash (a simple Hebrew letter-substitution cipher from ~600 BCE), Caesar cipher (shift cipher), Vigenère cipher (polyalphabetic substitution), the One-Time Pad (XOR with a truly random key), and AES-256-GCM (authenticated symmetric encryption via the Web Crypto API with PBKDF2-SHA256 key derivation at 200,000 iterations). Each cipher is implemented in pure TypeScript with a live encoder/decoder and a working attack that demonstrates its fatal flaw — from Caesar brute-force to Kasiski examination to OTP key-reuse to GCM tamper detection. The security model progresses from no key space (Atbash) to computational security (AES-256-GCM symmetric authenticated encryption).

The attacks aren't just asserted — they're *visualized*: the Caesar histogram slides until its peak snaps onto E (that offset is the key), Kasiski color-highlights repeated ciphertext trigrams and factors their gaps down to the key length, the one-time-pad panel stacks C1/C2/P1/P2 as byte-aligned rows and lights up the identity `C1⊕C2 = P1⊕P2`, and a schematic "peek inside" GCM shows counter-mode keystream + GHASH so a flipped bit visibly invalidates the authentication tag. A single Index of Coincidence "leakage meter" is threaded across Atbash → Caesar → Vigenère so the frequency fingerprint can be watched flattening from ~0.065 toward ~0.038.

## Exhibits

1. **Atbash (~600 BCE)** — Latin and Hebrew Atbash encoders over the Jeremiah passages, plus a **Frequency Leakage Meter** proving the ciphertext's Index of Coincidence is identical to the plaintext's: a one-to-one swap hides *which* letter is which, never *how often* it appears.
2. **Caesar (~58 BCE)** — a live shift cipher whose frequency chart overlays the reference English distribution behind the ciphertext bars. "Break It" slides the histogram until the tell-tale peak lands on **E**, labels it, and ranks all 25 shifts by χ² fitness so the winning key is visibly the best statistical match to English.
3. **Vigenère (1553)** — polyalphabetic encoder with an IC leakage meter that slides toward random as the keyword lengthens, and a **visual Kasiski examination**: repeated ciphertext sequences are color-highlighted in place, their gaps bracketed and labeled, then factored down to a common divisor — the recovered key length. A collapsible full step-by-step report backs the visual.
4. **One-Time Pad (1882)** — live XOR encryption plus a key-reuse attack rendered as a **byte-aligned grid** (K, C1, C2, C1⊕C2, P1⊕P2) that lights up the identity `C1⊕C2 = P1⊕P2` in green, and interactive crib-dragging that slides a guessed word across the row and turns Message 2 readable underneath.
5. **AES-256-GCM (2001)** — real Web Crypto authenticated encryption (PBKDF2-SHA256, 200k iterations, random IV/salt, 128-bit tag), a **"Peek Inside GCM" schematic** (passphrase → PBKDF2 → key → counter-mode keystream → ciphertext → GHASH → tag), and a tamper control that animates one flipped byte propagating into a stale tag, which live GCM verification then rejects.

Plus a **Full Arc** synthesis tab tying the five fatal flaws and their fixes into one timeline.

## When to Use It

- **Teaching cryptographic history end-to-end** — the demo walks from the oldest known cipher (Jeremiah's Atbash) to modern authenticated encryption in a single interactive timeline.
- **Demonstrating why each classical cipher fails** — every panel includes a working attack so students can see the vulnerability firsthand rather than read about it.
- **Showing AES-256-GCM authenticated encryption in the browser** — uses the Web Crypto API directly, with PBKDF2 key derivation, a random IV, and GCM integrity verification.
- **Exploring the Hebrew Bible's use of Atbash** — the demo includes original Hebrew text rendering for Jeremiah 25:26, 51:1, and 51:41 with both Latin and Hebrew Atbash encoders.
- **Do not use this for production encryption** — the demo is educational. Key material lives in the DOM and is never protected against side-channel extraction.

## Live Demo

[**systemslibrarian.github.io/crypto-lab-dead-sea-cipher/**](https://systemslibrarian.github.io/crypto-lab-dead-sea-cipher/)

The demo presents a tabbed timeline (Atbash → Caesar → Vigenère → OTP → AES → Full Arc). Each tab lets you type plaintext, adjust parameters (e.g. Caesar shift 1–25, Vigenère keyword, AES passphrase), and see real-time encryption output. Every classical cipher tab includes a "Break It" button that runs the corresponding cryptanalytic attack live in the browser.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-dead-sea-cipher.git
cd crypto-lab-dead-sea-cipher/demos/dead-sea-cipher
npm install
npm run dev
```

## Part of the Crypto-Lab Suite

This demo is part of the [Crypto-Lab](https://systemslibrarian.github.io/crypto-lab/) collection of interactive cryptography demonstrations.

---

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
