import { describe, it, expect } from 'vitest';
import { withScheme, isValidUrl, siteKey, looksLikeSite, pickSite, findDuplicate } from './entryUtils';

describe('withScheme / isValidUrl / siteKey', () => {
  it('assumes https for a bare host and leaves other schemes alone', () => {
    expect(withScheme(' ssh.db-world.in ')).toBe('https://ssh.db-world.in');
    expect(withScheme('http://a.io')).toBe('http://a.io');
    expect(withScheme('')).toBe('');
  });
  it('accepts hosts and rejects plain words', () => {
    expect(isValidUrl('ssh.db-world.in')).toBe(true);
    expect(isValidUrl('netflix')).toBe(false);
    expect(isValidUrl('my bank')).toBe(false);
  });
  it('reduces a URL to its bare lower-case host', () => {
    expect(siteKey('https://WWW.Netflix.com/login?x=1')).toBe('netflix.com');
    expect(siteKey('netflix')).toBe('');
  });
});

describe('looksLikeSite', () => {
  it.each(['netflix.com', 'https://x.io/login', 'ssh.db-world.in:22', 'www.a.co.uk'])('%s is a site', (t) => {
    expect(looksLikeSite(t)).toBe(true);
  });
  it.each(['Net flix', 'my bank', 'Home server', 'netflix', '', '   '])('%j is a name', (t) => {
    expect(looksLikeSite(t)).toBe(false);
  });
});

describe('pickSite', () => {
  const results = [{ name: 'Netflix', domain: 'netflix.com' }, { name: 'Netflix Games', domain: 'netflixgames.com' }];
  it('fills in by itself when name and brand agree, spaces and case ignored', () => {
    expect(pickSite('Net flix', results).auto.domain).toBe('netflix.com');
    expect(pickSite('NETFLIX', results).auto.domain).toBe('netflix.com');
  });
  it('only suggests when the match is loose', () => {
    const r = pickSite('streaming', results);
    expect(r.auto).toBeNull();
    expect(r.suggest.domain).toBe('netflix.com');
  });
  it('gives nothing for too-short input or no results', () => {
    expect(pickSite('a', results)).toEqual({ auto: null, suggest: null });
    expect(pickSite('netflix', [])).toEqual({ auto: null, suggest: null });
  });
});

describe('findDuplicate', () => {
  const vault = [
    { host: 'netflix.com', credentials: [{ url: 'https://netflix.com', name: 'Netflix', username: 'Me@x.com' }] },
    { host: 'db-world SSH', credentials: [{ url: null, name: 'db-world SSH', username: 'dbworld_admin' }] },
    { host: 'github.com', credentials: [{ url: 'https://github.com', username: 'old' }] }, // saved before names existed
  ];
  it('finds the same login on the same site, ignoring case', () => {
    expect(findDuplicate(vault, { url: 'netflix.com', name: 'netflix', username: 'me@x.com' })).not.toBeNull();
  });
  it('lets a second account on the same site through', () => {
    expect(findDuplicate(vault, { url: 'netflix.com', name: 'Netflix', username: 'other@x.com' })).toBeNull();
  });
  it('matches site-less entries by name and username', () => {
    expect(findDuplicate(vault, { url: '', name: 'DB-WORLD ssh', username: 'dbworld_admin' })).not.toBeNull();
    expect(findDuplicate(vault, { url: '', name: 'other box', username: 'dbworld_admin' })).toBeNull();
  });
  it('treats a nameless old entry as named after its site', () => {
    expect(findDuplicate(vault, { url: 'github.com', name: '', username: 'old' })).not.toBeNull();
  });
  it('ignores the entry being edited, so keeping its own name and username is fine', () => {
    const v = [{ host: 'netflix.com', credentials: [{ id: 'c1', url: 'https://netflix.com', name: 'Netflix', username: 'me' }] }];
    expect(findDuplicate(v, { url: 'netflix.com', name: 'Netflix', username: 'me' })).not.toBeNull();
    expect(findDuplicate(v, { url: 'netflix.com', name: 'Netflix', username: 'me', ignoreId: 'c1' })).toBeNull();
  });
  it('does not mix site and site-less entries', () => {
    expect(findDuplicate(vault, { url: 'x.io', name: 'db-world SSH', username: 'dbworld_admin' })).toBeNull();
  });
});
