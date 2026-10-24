import { describe, it, expect } from 'vitest';
import { applyFilters } from './offlineFilters';

/**
 * These assert PARITY with WalletDocumentService.list, not just "a filter works".
 *
 * An offline search that finds documents the online one would not is the failure mode
 * worth guarding: the same query returning different answers depending on signal is
 * exactly what stops a document store feeling trustworthy. The server matches the label
 * and nothing else, so these pin that down — including the fields it deliberately does
 * NOT search.
 */
const DOCS = [
  { id: '1', typeId: 'passport', label: 'Passport', maskedNumber: '•••4412', holderName: 'Asha', notes: 'in the safe' },
  { id: '2', typeId: 'licence', label: 'Driving Licence', maskedNumber: '•••9931', holderName: 'Bhavya', notes: 'renew soon' },
  { id: '3', typeId: 'licence', label: 'Gun Licence', maskedNumber: '•••0007', holderName: 'Asha', notes: null },
];
const ids = (list) => list.map((d) => d.id);

describe('applyFilters', () => {
  it('returns the list untouched when nothing is being filtered', () => {
    expect(applyFilters(DOCS, undefined)).toBe(DOCS);
    expect(applyFilters(DOCS, {})).toBe(DOCS);
    expect(ids(applyFilters(DOCS, { q: '', typeId: '' }))).toEqual(['1', '2', '3']);
  });

  it('matches the label case-insensitively, anywhere in it', () => {
    expect(ids(applyFilters(DOCS, { q: 'licence' }))).toEqual(['2', '3']);
    expect(ids(applyFilters(DOCS, { q: 'LICENCE' }))).toEqual(['2', '3']);
    expect(ids(applyFilters(DOCS, { q: 'ivin' }))).toEqual(['2']);
  });

  it('matches ONLY the label — never the number, holder or notes', () => {
    // The server searches d.getLabel() alone. Matching more here would return documents
    // online never would.
    expect(applyFilters(DOCS, { q: '4412' })).toEqual([]);   // number
    expect(applyFilters(DOCS, { q: 'Asha' })).toEqual([]);   // holder
    expect(applyFilters(DOCS, { q: 'safe' })).toEqual([]);   // notes
  });

  it('treats a whitespace-only query as no query, like the server trim does', () => {
    expect(ids(applyFilters(DOCS, { q: '   ' }))).toEqual(['1', '2', '3']);
  });

  it('filters by type, comparing as strings so a numeric id still matches', () => {
    expect(ids(applyFilters(DOCS, { typeId: 'licence' }))).toEqual(['2', '3']);
    const numeric = [{ id: 'a', typeId: 7, label: 'Seven' }];
    expect(ids(applyFilters(numeric, { typeId: '7' }))).toEqual(['a']);
    expect(ids(applyFilters(numeric, { typeId: 7 }))).toEqual(['a']);
  });

  it('applies type and query together', () => {
    expect(ids(applyFilters(DOCS, { typeId: 'licence', q: 'gun' }))).toEqual(['3']);
    expect(applyFilters(DOCS, { typeId: 'passport', q: 'gun' })).toEqual([]);
  });

  it('survives a missing list or a document with no label', () => {
    expect(applyFilters(undefined, { q: 'x' })).toEqual([]);
    expect(applyFilters(null, undefined)).toEqual([]);
    expect(applyFilters([{ id: 'x' }], { q: 'anything' })).toEqual([]);
  });
});
