# dead-sea-cipher

A browser-based cryptographic history demo for the [crypto-compare](https://github.com/systemslibrarian/crypto-compare) portfolio. Walks the full arc of cryptographic history — from Atbash (~600 BCE) through AES-256-GCM (2001 CE).

## Live Demo

**[systemslibrarian.github.io/crypto-lab-dead-sea-cipher](https://systemslibrarian.github.io/crypto-lab-dead-sea-cipher/)**

## Historical & Classical Ciphers

| Field | Value |
|-------|-------|
| Coverage | Atbash → Caesar → Vigenère → OTP → AES-256-GCM |
| Time span | ~600 BCE to 2001 CE |
| Scripture connection | Jeremiah 25:26, 51:1, 51:41 |
| Live attacks | Caesar brute force, Kasiski, OTP key reuse, AES tamper detection |
| Educational focus | Why each cipher failed; what the next fixed |

## Quick Start

```bash
cd demos/dead-sea-cipher
npm install
npm run dev
```

See [demos/dead-sea-cipher/README.md](demos/dead-sea-cipher/README.md) for full documentation.

See also:
- [iron-serpent](https://github.com/systemslibrarian/crypto-compare) — Modern block ciphers like Serpent-256 inherit every lesson encoded in this timeline
- [ciphermuseum.com](https://ciphermuseum.com) — The narrative companion to this demo