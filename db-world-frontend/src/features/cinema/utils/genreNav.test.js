import { describe, it, expect } from 'vitest';
import Constants from '@shared/constants';
import { genreSlug, genreIdFromSlug, genreNameFromSlug, genrePath, pagePath } from './genreNav';

describe('genreSlug', () => {
  it('joins the id with a url-safe name', () => {
    expect(genreSlug({ id: 28, name: 'Action' })).toBe('28-action');
  });

  it('collapses punctuation and spaces into single dashes', () => {
    expect(genreSlug({ id: 10765, name: 'Sci-Fi & Fantasy' })).toBe('10765-sci-fi-fantasy');
    expect(genreSlug({ id: 99, name: '  Action / Adventure  ' })).toBe('99-action-adventure');
  });

  it('falls back to the bare id when the name has nothing url-safe in it', () => {
    expect(genreSlug({ id: 7, name: '???' })).toBe('7');
    expect(genreSlug({ id: 7 })).toBe('7');
  });
});

describe('genreIdFromSlug', () => {
  it('reads the leading id', () => {
    expect(genreIdFromSlug('28-action')).toBe(28);
    expect(genreIdFromSlug('7')).toBe(7);
  });

  it('returns null for anything that does not start with a positive id', () => {
    expect(genreIdFromSlug('action')).toBeNull();
    expect(genreIdFromSlug('')).toBeNull();
    expect(genreIdFromSlug(undefined)).toBeNull();
    expect(genreIdFromSlug('0-nothing')).toBeNull();
    expect(genreIdFromSlug('-3-negative')).toBeNull();
  });
});

describe('genreNameFromSlug', () => {
  it('title-cases the name half', () => {
    expect(genreNameFromSlug('28-action')).toBe('Action');
    expect(genreNameFromSlug('10765-sci-fi-fantasy')).toBe('Sci Fi Fantasy');
  });

  it('is empty when the slug carries no name', () => {
    expect(genreNameFromSlug('28')).toBe('');
    expect(genreNameFromSlug(undefined)).toBe('');
  });
});

describe('genrePath', () => {
  it('nests the genre under the section it was picked from', () => {
    expect(genrePath('movies', { id: 28, name: 'Action' }))
      .toBe(`${Constants.DB_CINEMA_MOVIES_ROUTE}/genre/28-action`);
    expect(genrePath('series', { id: 35, name: 'Comedy' }))
      .toBe(`${Constants.DB_CINEMA_SERIES_ROUTE}/genre/35-comedy`);
    expect(genrePath('home', { id: 18, name: 'Drama' }))
      .toBe(`${Constants.DB_CINEMA_BROWSE_ROUTE}/genre/18-drama`);
  });

  it('returns the plain section path when no genre is selected', () => {
    expect(genrePath('movies', null)).toBe(Constants.DB_CINEMA_MOVIES_ROUTE);
  });

  it('treats an unknown page as Browse', () => {
    expect(pagePath('nonsense')).toBe(Constants.DB_CINEMA_BROWSE_ROUTE);
  });
});
