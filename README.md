# crypto-lab-dead-sea-cipher

## What It Is

A browser-based cryptographic history demo that walks the full arc of cryptographic history — from Atbash (~600 BCE) through AES-256-GCM (2001 CE). Each stage shows why a cipher failed and what the next one fixed, turning the timeline into a story about how secrecy was repeatedly broken and rebuilt.

## When to Use It

- Teaching the historical progression of ciphers — substitution, Atbash, Caesar, Vigenère, the one-time pad, and modern AEAD — as one connected narrative.
- Demonstrating live classical attacks (Caesar brute force, Kasiski examination, one-time-pad key reuse) so the weaknesses are seen rather than asserted.
- Showing the contrast between a classical cipher and a modern authenticated cipher (AES-256-GCM tamper detection) at the end of the timeline.
- Do NOT use the classical ciphers here for any real protection — they are historical teaching examples, broken by design, not production cryptography.

## Live Demo

**[systemslibrarian.github.io/crypto-lab-dead-sea-cipher](https://systemslibrarian.github.io/crypto-lab-dead-sea-cipher/)**

The demo steps through the cipher timeline from Atbash and Caesar, through the Vigenère polyalphabetic cipher and the one-time pad, up to AES-256-GCM. Along the way it runs live attacks — Caesar brute force, Kasiski analysis of Vigenère, two-time-pad recovery from one-time-pad key reuse — and finishes by showing AES-256-GCM rejecting a tampered ciphertext, so each cipher's failure mode and the fix that followed are demonstrated interactively.

## What Can Go Wrong

- **Monoalphabetic substitution leaks structure.** Atbash, Caesar, and simple substitution preserve letter frequencies, so frequency analysis and brute force over a tiny key space recover the plaintext quickly.
- **Vigenère is broken by period detection.** Once the key length is found (Kasiski examination, index of coincidence), the cipher reduces to several independent Caesar shifts and falls to frequency analysis.
- **One-time-pad key reuse is catastrophic.** Reusing a pad turns it into a two-time pad; XORing two ciphertexts cancels the key and exposes both messages to crib-dragging.
- **Confidentiality without integrity is not enough.** Classical ciphers provide no authentication, so a ciphertext can be altered undetected — the lesson that motivates authenticated encryption (AES-256-GCM) at the end of the timeline.

## Real-World Usage

- The ciphers in this demo are primarily of historical and educational value; the classical ones are obsolete for protecting real data.
- Substitution and Vigenère-style ciphers persist in puzzles, CTF challenges, and teaching exercises for cryptanalysis fundamentals.
- The one-time pad, when keys are truly random, single-use, and as long as the message, remains the textbook example of information-theoretic perfect secrecy.
- AES-256-GCM, the modern endpoint of the timeline, is the authenticated cipher actually deployed today in TLS, disk encryption, and countless protocols.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-dead-sea-cipher
cd crypto-lab-dead-sea-cipher/demos/dead-sea-cipher
npm install
npm run dev
```

## Related Demos

- [crypto-lab-vigenere-break](https://systemslibrarian.github.io/crypto-lab-vigenere-break/) — breaks the Vigenère cipher with Kasiski examination and index of coincidence.
- [crypto-lab-enigma-forge](https://systemslibrarian.github.io/crypto-lab-enigma-forge/) — rotors, plugboard, and a Bombe-style attack on the Enigma machine.
- [crypto-lab-otp-vault](https://systemslibrarian.github.io/crypto-lab-otp-vault/) — one-time-pad perfect secrecy and the two-time-pad reuse failure.
- [crypto-lab-iron-serpent](https://systemslibrarian.github.io/crypto-lab-iron-serpent/) — modern block ciphers (Serpent, AES-256) that inherit the lessons of this timeline.

## Historical & Classical Ciphers

| Field | Value |
|-------|-------|
| Coverage | Atbash → Caesar → Vigenère → OTP → AES-256-GCM |
| Time span | ~600 BCE to 2001 CE |
| Scripture connection | Jeremiah 25:26, 51:1, 51:41 |
| Live attacks | Caesar brute force, Kasiski, OTP key reuse, AES tamper detection |
| Educational focus | Why each cipher failed; what the next fixed |

Narrative companion: [ciphermuseum.com](https://ciphermuseum.com).

---

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
