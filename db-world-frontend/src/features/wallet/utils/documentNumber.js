/**
 * Recognising a document number in a wall of OCR text.
 *
 * This file is the reason scanning is safe to offer at all. Generic OCR on a photographed ID gives
 * you a page of noisy text; asking "is there a number in here" of that is how you end up storing a
 * confidently wrong Aadhaar. Extraction is therefore scoped to the document TYPE and, wherever the
 * format has one, gated on a checksum.
 *
 * The consequence worth stating plainly: the failure mode is "no suggestion", not "wrong number".
 * A misread Aadhaar digit almost never survives Verhoeff, so a bad scan produces silence rather
 * than a plausible-looking lie the reader would have no reason to doubt.
 *
 * Everything here is pure — no OCR engine, no DOM — so it is testable on its own and equally usable
 * to validate a number somebody typed by hand.
 */

// ─── Verhoeff, as UIDAI specifies for Aadhaar ────────────────────────────────────────────────
// The dihedral group D5 multiplication table, the permutation table, and the inverse table. These
// are the algorithm's published constants, not tuning.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Verhoeff check over a digit string. Returns false for anything that isn't all digits, so callers
 * don't have to pre-clean.
 *
 * This is what makes an Aadhaar suggestion trustworthy: it catches every single-digit error and
 * every adjacent transposition, which between them are the overwhelming majority of what OCR gets
 * wrong on a twelve-digit run.
 */
export const verhoeffValid = (digits) => {
  if (!/^\d+$/.test(digits ?? '')) return false;
  let c = 0;
  const reversed = digits.split('').reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    c = D[c][P[i % 8][Number(reversed[i])]];
  }
  return c === 0;
};

/** Aadhaar never starts 0 or 1 — UIDAI reserves those — which rules out a lot of stray twelve-digit
 * runs (dates, reference numbers) before the checksum is even consulted. */
const aadhaarValid = (raw) => {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 12 && !/^[01]/.test(digits) && verhoeffValid(digits);
};

/**
 * The 4th character of a PAN encodes the holder type (P for an individual, C company, H HUF, …) and
 * the 10th is a checksum letter we can't verify offline. Checking the position we CAN check still
 * throws out most of what a five-letter word followed by digits would otherwise match.
 */
const PAN_HOLDER_TYPES = 'ABCFGHLJPTKE';
const panValid = (raw) => {
  const s = raw.toUpperCase().replace(/\s/g, '');
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(s) && PAN_HOLDER_TYPES.includes(s[3]);
};

/**
 * What a number looks like, per document type.
 *
 * Keyed by the type's stable `code`, never its display name — an admin can rename "Aadhaar Card"
 * and this must not stop working. A type absent from this map gets NO extraction at all: guessing
 * at a rent agreement's "number" would produce noise, and silence is the correct answer.
 *
 * `format` is applied only after validation, so the suggestion is shown the way the issuing
 * authority prints it rather than as the run of characters OCR happened to return.
 */
const PATTERNS = {
  AADHAAR: {
    // Tolerates the spaces and hyphens Aadhaar is printed with, and the ones OCR invents - but a
    // LITERAL space, never `\s`. Allowing any whitespace let the separator match a NEWLINE, so a
    // four-digit run on the line above (a year of birth, say) merged with the first eight digits of
    // the real number into one bogus candidate and consumed the genuine one along with it.
    pattern: /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g,
    valid: aadhaarValid,
    format: (raw) => raw.replace(/\D/g, '').replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3'),
  },
  PAN: {
    pattern: /\b[A-Z]{5} ?\d{4} ?[A-Z]\b/gi,
    valid: panValid,
    format: (raw) => raw.toUpperCase().replace(/\s/g, ''),
  },
  VOTER_ID: {
    pattern: /\b[A-Z]{3} ?\d{7}\b/gi,
    valid: (raw) => /^[A-Z]{3} ?\d{7}$/i.test(raw.trim()),
    format: (raw) => raw.toUpperCase().replace(/\s/g, ''),
  },
  PASSPORT: {
    // Indian passports are one letter then seven digits. Deliberately excludes Q, X and Z, which
    // are not issued and which OCR reaches for when it misreads O, K or 2.
    pattern: /\b[A-PR-WY] ?\d{7}\b/gi,
    valid: (raw) => /^[A-PR-WY] ?\d{7}$/i.test(raw.trim()),
    format: (raw) => raw.toUpperCase().replace(/\s/g, ''),
  },
  DRIVING_LICENCE: {
    // State code, RTO, then the serial — printed with and without separators depending on the state.
    pattern: /\b[A-Z]{2}[ -]?\d{2}[ -]?\d{4}[ -]?\d{7}\b/gi,
    valid: (raw) => raw.replace(/[^A-Z0-9]/gi, '').length === 15,
    format: (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, ''),
  },
  VEHICLE_RC: {
    pattern: /\b[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4}\b/gi,
    valid: () => true,
    format: (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, ''),
  },
};

/** Whether scanning can do anything useful for a type — drives whether the button is offered. */
export const canExtractNumber = (typeCode) => !!PATTERNS[typeCode];

/** The document types scanning understands, for anyone who needs to explain the feature. */
export const EXTRACTABLE_TYPE_CODES = Object.keys(PATTERNS);

/**
 * First valid number of this type in `text`, formatted as the authority prints it — or null.
 *
 * "First valid" rather than "first match" is the whole design: a page of OCR text from an Aadhaar
 * card typically holds several twelve-digit runs (a VID, an enrolment number, a date mangled into
 * digits), and only one of them satisfies Verhoeff.
 */
export const extractDocumentNumber = (text, typeCode) => {
  const spec = PATTERNS[typeCode];
  if (!spec || !text) return null;
  const matches = String(text).match(spec.pattern);
  if (!matches) return null;
  for (const raw of matches) {
    const candidate = raw.trim();
    if (spec.valid(candidate)) return spec.format(candidate);
  }
  return null;
};

/**
 * Validates a number the user typed, for the same types. Returns null when there is nothing to say
 * — an unknown type, or an empty field — so callers can treat null as "no opinion" rather than
 * having to distinguish it from "invalid".
 */
export const validateDocumentNumber = (value, typeCode) => {
  const spec = PATTERNS[typeCode];
  const trimmed = (value ?? '').trim();
  if (!spec || !trimmed) return null;
  return spec.valid(trimmed);
};
