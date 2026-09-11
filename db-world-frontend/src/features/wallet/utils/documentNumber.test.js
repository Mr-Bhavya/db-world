import { describe, it, expect } from 'vitest';
import {
  verhoeffValid, extractDocumentNumber, validateDocumentNumber, canExtractNumber,
} from './documentNumber';

// Verhoeff-valid twelve-digit numbers that are not real Aadhaars — the checksum is the only thing
// under test, and these were generated to satisfy it.
const VALID_AADHAAR = '234567890124';
const VALID_AADHAAR_2 = '200000000959';

describe('verhoeffValid', () => {
  it('accepts a number whose check digit is correct', () => {
    expect(verhoeffValid(VALID_AADHAAR)).toBe(true);
    expect(verhoeffValid(VALID_AADHAAR_2)).toBe(true);
  });

  it('rejects every single-digit error — the most common OCR failure', () => {
    for (let i = 0; i < VALID_AADHAAR.length; i += 1) {
      for (let d = 0; d <= 9; d += 1) {
        if (String(d) === VALID_AADHAAR[i]) continue;
        const mangled = VALID_AADHAAR.slice(0, i) + d + VALID_AADHAAR.slice(i + 1);
        expect(verhoeffValid(mangled)).toBe(false);
      }
    }
  });

  it('rejects adjacent transpositions — the second most common', () => {
    for (let i = 0; i < VALID_AADHAAR.length - 1; i += 1) {
      if (VALID_AADHAAR[i] === VALID_AADHAAR[i + 1]) continue;
      const swapped = VALID_AADHAAR.slice(0, i)
        + VALID_AADHAAR[i + 1] + VALID_AADHAAR[i]
        + VALID_AADHAAR.slice(i + 2);
      expect(verhoeffValid(swapped)).toBe(false);
    }
  });

  it('rejects non-digits and empties rather than throwing', () => {
    expect(verhoeffValid('12ab56789012')).toBe(false);
    expect(verhoeffValid('')).toBe(false);
    expect(verhoeffValid(null)).toBe(false);
  });
});

describe('extractDocumentNumber — Aadhaar', () => {
  it('finds the number in surrounding OCR noise and formats it in groups of four', () => {
    const text = `GOVERNMENT OF INDIA\nBhavya Dudhia\nDOB: 12/04/1994\n${VALID_AADHAAR.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')}\nVID : 9012 3456 7890 1234`;
    expect(extractDocumentNumber(text, 'AADHAAR')).toBe('2345 6789 0124');
  });

  it('skips twelve-digit runs that fail the checksum and keeps looking', () => {
    // The first candidate is a plausible-looking but invalid run; the second is the real one.
    const text = `Enrolment 9012 3456 7890\n${VALID_AADHAAR}`;
    expect(extractDocumentNumber(text, 'AADHAAR')).toBe('2345 6789 0124');
  });

  it('returns null rather than a guess when nothing validates', () => {
    // This is the failure mode that matters: silence, not a confident wrong answer.
    // Both of these fail Verhoeff. Worth noting that plenty of "obviously fake" runs like
    // 1111 2222 3333 actually PASS it, so these fixtures are chosen, not assumed.
    expect(extractDocumentNumber('9012 3456 7890 and 3456 7890 1237', 'AADHAAR')).toBeNull();
    expect(extractDocumentNumber('no numbers here at all', 'AADHAAR')).toBeNull();
  });

  it('rejects numbers starting 0 or 1, which UIDAI does not issue', () => {
    expect(extractDocumentNumber('0234 5678 9012', 'AADHAAR')).toBeNull();
  });
});

describe('extractDocumentNumber — PAN', () => {
  it('finds and upper-cases a PAN', () => {
    expect(extractDocumentNumber('Permanent Account Number\nabcpe1234f', 'PAN')).toBe('ABCPE1234F');
  });

  it('rejects a five-letter word plus digits whose holder-type character is invalid', () => {
    // "ABCDE1234F" has D in the holder-type position, which is not an issued category.
    expect(extractDocumentNumber('ABCDE1234F', 'PAN')).toBeNull();
  });
});

describe('extractDocumentNumber — other types', () => {
  it('reads a Voter ID and a passport number', () => {
    expect(extractDocumentNumber('EPIC No: abc1234567', 'VOTER_ID')).toBe('ABC1234567');
    expect(extractDocumentNumber('Passport No. M1234567', 'PASSPORT')).toBe('M1234567');
  });

  it('will not read a passport letter India never issues', () => {
    expect(extractDocumentNumber('Q1234567', 'PASSPORT')).toBeNull();
  });

  it('extracts nothing for a type with no defined format, rather than guessing', () => {
    // A rent agreement has no "number"; inventing one from stray digits would be noise.
    expect(extractDocumentNumber('Agreement dated 01/04/2026 ref 998877', 'RENT_AGREEMENT')).toBeNull();
    expect(canExtractNumber('RENT_AGREEMENT')).toBe(false);
    expect(canExtractNumber('AADHAAR')).toBe(true);
  });

  it('is null-safe on empty input', () => {
    expect(extractDocumentNumber(null, 'AADHAAR')).toBeNull();
    expect(extractDocumentNumber('', 'AADHAAR')).toBeNull();
  });
});

describe('validateDocumentNumber', () => {
  it('judges a typed number for types it understands', () => {
    expect(validateDocumentNumber('2345 6789 0124', 'AADHAAR')).toBe(true);
    expect(validateDocumentNumber('2345 6789 0125', 'AADHAAR')).toBe(false);
    expect(validateDocumentNumber('ABCPE1234F', 'PAN')).toBe(true);
  });

  it('has no opinion — null, not false — on an unknown type or an empty field', () => {
    expect(validateDocumentNumber('anything', 'RENT_AGREEMENT')).toBeNull();
    expect(validateDocumentNumber('', 'AADHAAR')).toBeNull();
    expect(validateDocumentNumber(null, 'AADHAAR')).toBeNull();
  });
});
