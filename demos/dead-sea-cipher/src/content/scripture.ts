/**
 * Scripture references and historical content for the Dead Sea Cipher demo.
 * All references verified against the Hebrew Bible and standard English translations.
 */

export const SCRIPTURE_REFERENCES = {
  jeremiah_25_26: {
    reference: 'Jeremiah 25:26',
    translation: 'ESV',
    english: 'And after them the king of Babylon shall drink.',
    encoded_word: 'Sheshach',
    decoded_word: 'Babel',
    hebrew_encoded: 'ששך',
    hebrew_decoded: 'בבל',
    note: 'The ESV renders the name as "Babylon" and gives the Hebrew, ששך (Sheshach), in a footnote. Atbash turns ששך into בבל (Babel) in this passage.',
  },
  jeremiah_51_41: {
    reference: 'Jeremiah 51:41',
    translation: 'ESV',
    english: 'How Babylon is taken, the praise of the whole earth seized!',
    encoded_word: 'Sheshach',
    decoded_word: 'Babel',
    hebrew_encoded: 'ששך',
    hebrew_decoded: 'בבל',
    note: 'Here too the Hebrew reads ששך (Sheshach), footnoted by the ESV — a second use of Atbash in Jeremiah, encoding the same enemy.',
  },
  lev_kamai: {
    reference: 'Jeremiah 51:1',
    translation: 'ESV',
    english: 'Thus says the LORD: Behold, I will stir up the spirit of a destroyer against Babylon, against the inhabitants of Leb-kamai.',
    encoded_word: 'Lev Kamai',
    decoded_word: 'Chaldea',
    hebrew_encoded: 'לב קמי',
    hebrew_decoded: 'כשדים',
    note: 'Chaldea encoded as Lev Kamai — a third Atbash encoding in Jeremiah.',
  },
  closing: {
    reference: '1 Corinthians 10:31',
    translation: 'NIV',
    english: 'So whether you eat or drink or whatever you do, do it all for the glory of God.',
  },
} as const;

export interface EraInfo {
  id: string;
  name: string;
  year: string;
  tagline: string;
  fatalFlaw: string;
  whatItFixed: string;
  whatNextFixed: string;
}

export const ERAS: EraInfo[] = [
  {
    id: 'atbash',
    name: 'Atbash',
    year: '~600 BCE',
    tagline: 'The cipher hidden in Scripture',
    fatalFlaw: 'One fixed mapping gives zero bits of key choice. Anyone who knows the system can decode it instantly.',
    whatItFixed: 'Used a fixed substitution to represent a name in the Book of Jeremiah.',
    whatNextFixed: 'Caesar introduced a variable shift, creating 25 possible keys instead of 1.',
  },
  {
    id: 'caesar',
    name: 'Caesar Cipher',
    year: '~58 BCE',
    tagline: 'The emperor\'s secret shift',
    fatalFlaw: 'Monoalphabetic substitution with only 25 possible keys. Frequency analysis reveals the shift; brute force takes seconds.',
    whatItFixed: 'Introduced a key (the shift value), creating multiple possible mappings.',
    whatNextFixed: 'Vigenère used multiple alphabets, defeating single-alphabet frequency analysis.',
  },
  {
    id: 'vigenere',
    name: 'Vigenère Cipher',
    year: '1553',
    tagline: 'Le chiffre indéchiffrable — or so they thought',
    fatalFlaw: 'Repeating key creates patterns. Kasiski examination (1863) reveals the key length, then each column falls to frequency analysis.',
    whatItFixed: 'Polyalphabetic substitution — each letter can encrypt to many different ciphertext letters.',
    whatNextFixed: 'The One-Time Pad eliminated key repetition entirely: the key is as long as the message.',
  },
  {
    id: 'otp',
    name: 'One-Time Pad',
    year: '1882',
    tagline: 'Perfect secrecy, impossible logistics',
    fatalFlaw: 'Key must be as long as the message, truly random, and never reused. Key distribution is operationally impossible at scale.',
    whatItFixed: 'Information-theoretically secure — Shannon proved no amount of computation can break it (1949).',
    whatNextFixed: 'AES-256-GCM achieves computational security with a practical key size (256 bits) and adds integrity verification.',
  },
  {
    id: 'aes',
    name: 'AES-256-GCM',
    year: '2001 / 2007',
    tagline: '2,600 years of cryptographic lessons in one algorithm',
    fatalFlaw: 'None known — relies on computational hardness. Quantum computing (Grover\'s algorithm) reduces effective key space to 128 bits, still considered secure.',
    whatItFixed: 'Practical key size, authenticated encryption (integrity + confidentiality), standardized by NIST.',
    whatNextFixed: 'Post-quantum cryptography is the next frontier.',
  },
];

export const FULL_ARC_REFLECTION = `From a prophet encoding the name of an empire in sacred text, to an emperor shifting letters by three, to a "perfect" cipher broken after 300 years of false confidence, to a mathematically perfect system impossible to deploy, to an algorithm that carries every lesson forward — the arc of cryptography is a story of human ingenuity confronting its own limitations.

Each cipher failed. Each failure taught something irreplaceable. And each successor was built on the wreckage of what came before.

AES-256-GCM doesn't exist in isolation. It is the living summary of 2,600 years of cryptographic history — from Jeremiah's Atbash to Shannon's proof to NIST's selection process. Every design decision in modern cryptography carries the DNA of every cipher that fell before it.`;

export const LESSONS_MAP = [
  {
    flaw: 'Atbash: One fixed mapping',
    aesSolution: 'AES uses a 256-bit key: 2²⁵⁶ possible keys (~1.15 × 10⁷⁷)',
  },
  {
    flaw: 'Caesar: Only 25 possible shifts',
    aesSolution: 'AES key space is astronomically large — brute force is infeasible',
  },
  {
    flaw: 'Vigenère: Repeating key creates patterns',
    aesSolution: 'AES uses unique IVs and counter mode — no pattern repetition',
  },
  {
    flaw: 'OTP: Key as long as message, impossible distribution',
    aesSolution: 'AES derives a 256-bit key from a passphrase via PBKDF2',
  },
  {
    flaw: 'All classical: No integrity verification',
    aesSolution: 'GCM mode provides authenticated encryption — tampered ciphertext is rejected',
  },
];
