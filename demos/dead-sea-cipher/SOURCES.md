# Sources — Dead Sea Cipher

Every historical claim in this demo is sourced. This document provides the references.

---

## Atbash Cipher (~600 BCE)

- **Primary text:** Jeremiah 25:26, 51:1, 51:41 (Hebrew Bible / Tanakh)
  - Jeremiah 25:26 — "Sheshach" (ששך) = Atbash encoding of "Babel" (בבל)
  - Jeremiah 51:41 — "Sheshach" again, same encoding
  - Jeremiah 51:1 — "Lev Kamai" (לב קמי) = Atbash encoding of "Chaldea" (כשדים)
- **Commentary:** Rashi's commentary on Jeremiah 25:26 identifies Sheshach as Babel via Atbash substitution. See also: *The Anchor Yale Bible Dictionary*, Vol. 1, "Atbash."
- **Dating:** The Book of Jeremiah is generally dated to the late 7th/early 6th century BCE (~626–586 BCE). The Atbash usages are among the earliest documented uses of a substitution cipher.

## Caesar Cipher (~58 BCE)

- **Primary source:** Suetonius, *De Vita Caesarum* (*The Twelve Caesars*), "Divus Iulius," Chapter 56.
  - "If he had anything confidential to say, he wrote it in cipher, that is, by so changing the order of the letters of the alphabet, that not a word could be made out. If anyone wishes to decipher these, and get at their meaning, he must substitute the fourth letter of the alphabet, namely D, for A, and so with the others."
- **Shift value:** Caesar used a right shift of 3 (A→D, B→E, etc.).

## Vigenère Cipher (1553)

- **Actual inventor:** Giovan Battista Bellaso, *La Cifra del. Sig. Giovan Battista Bellaso* (1553). Bellaso described the polyalphabetic cipher that uses a repeating keyword.
- **Misattribution:** Blaise de Vigenère described a stronger autokey cipher in his *Traicté des Chiffres* (1586). The simpler Bellaso cipher was misattributed to Vigenère, and the name "Vigenère cipher" stuck.
- **"Le chiffre indéchiffrable":** The cipher was considered unbreakable for nearly 300 years until Babbage and Kasiski independently cracked it.
- **Source for misattribution history:** David Kahn, *The Codebreakers: The Comprehensive History of Secret Communication from Ancient Times to the Internet*, revised edition (Scribner, 1996), Chapter 5.

## Kasiski Examination (1863)

- **Published by:** Friedrich Wilhelm Kasiski, *Die Geheimschriften und die Dechiffrir-Kunst* (Berlin: E.S. Mittler und Sohn, 1863).
- **Babbage's unpublished work:** Charles Babbage broke the Vigenère cipher around 1854 but never published his method. Evidence of his work was found posthumously in his papers. See: Charles Babbage, *Passages from the Life of a Philosopher* (1864), and secondary analysis in Kahn, *The Codebreakers*, Chapter 7.

## One-Time Pad (1882 / 1917)

- **Frank Miller (1882):** Frank Miller described a one-time pad system for telegraph security in *Telegraphic Code to Insure Privacy and Secrecy in the Transmission of Telegrams* (1882). See: Steven M. Bellovin, "Frank Miller: Inventor of the One-Time Pad," *Cryptologia*, 35:3 (2011), pp. 203–222.
- **Gilbert Vernam (1917):** Gilbert S. Vernam, "Cipher Printing Telegraph Systems for Secret Wire and Radio Telegraphic Communications," *Journal of the AIEE*, Vol. 45 (1926), pp. 109–115. Patent filed 1917.
- **Shannon's proof:** Claude E. Shannon, "Communication Theory of Secrecy Systems," *Bell System Technical Journal*, Vol. 28, No. 4 (October 1949), pp. 656–715. Shannon proved that the one-time pad achieves perfect secrecy (information-theoretic security).

## AES-256-GCM (2000–2001)

- **AES selection:** NIST announced the selection of Rijndael as the Advanced Encryption Standard on October 2, 2000.
- **FIPS 197:** "Advanced Encryption Standard (AES)," Federal Information Processing Standards Publication 197, November 26, 2001. National Institute of Standards and Technology (NIST).
  - Available: https://csrc.nist.gov/pubs/fips/197/final
- **GCM mode:** David A. McGrew and John Viega, "The Galois/Counter Mode of Operation (GCM)," NIST submission, May 2005. Published in NIST SP 800-38D (November 2007).
- **PBKDF2:** B. Kaliski, "PKCS #5: Password-Based Cryptography Specification Version 2.0," RFC 2898 (September 2000). Updated by RFC 8018 (January 2017).

## General References

- David Kahn, *The Codebreakers: The Comprehensive History of Secret Communication from Ancient Times to the Internet*, revised edition (Scribner, 1996).
- Simon Singh, *The Code Book: The Science of Secrecy from Ancient Egypt to Quantum Cryptography* (Anchor Books, 2000).
- Bruce Schneier, *Applied Cryptography: Protocols, Algorithms, and Source Code in C*, 2nd edition (Wiley, 1996).

## Scripture References

- Jeremiah 25:26 (ESV): "and the king of Sheshach shall drink after them."
- Jeremiah 51:1 (ESV): "Thus says the LORD: Behold, I will stir up the spirit of a destroyer against Babylon, against the inhabitants of Leb-kamai."
- Jeremiah 51:41 (ESV): "How Sheshach is taken, the praise of the whole earth seized!"
- 1 Corinthians 10:31 (NIV): "So whether you eat or drink or whatever you do, do it all for the glory of God."

## Affine cipher

Paar & Pelzl, *Understanding Cryptography* (2010), §1.4.4, supplies teaching context for y = ax + b mod 26 and the 12 × 26 key space. No historical-use claim is made. Admissibility, inverses and the key count are independently computed in the page; original examples are checked in `src/__tests__/affine.test.ts`. The source section was verified by the supplied brief author; this implementation session independently verified the arithmetic.
