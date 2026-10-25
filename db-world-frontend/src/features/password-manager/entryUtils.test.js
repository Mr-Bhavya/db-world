import { describe, it, expect, vi } from 'vitest';
import { withScheme, isValidUrl, siteKey, looksLikeSite, pickSite, findDuplicate, isSecretField, linkTarget, changedLabel, purgeEach } from './entryUtils';

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

describe('isSecretField', () => {
  it('masks hidden, multi-line and untyped (old) fields', () => {
    expect(isSecretField({ fieldType: 'HIDDEN' })).toBe(true);
    expect(isSecretField({ fieldType: 'MULTILINE' })).toBe(true);
    expect(isSecretField({ fieldType: null })).toBe(true);
    expect(isSecretField({})).toBe(true);
  });
  it('shows text and URL fields as they are', () => {
    expect(isSecretField({ fieldType: 'TEXT' })).toBe(false);
    expect(isSecretField({ fieldType: 'URL' })).toBe(false);
  });
});

describe('linkTarget', () => {
  it('keeps an http(s) address as it is', () => {
    expect(linkTarget('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(linkTarget('http://localhost:8080')).toBe('http://localhost:8080');
    expect(linkTarget('http://192.168.1.10:8443/admin')).toBe('http://192.168.1.10:8443/admin');
  });
  it('assumes https for a bare host', () => {
    expect(linkTarget('example.com')).toBe('https://example.com');
    expect(linkTarget('  ssh.db-world.in ')).toBe('https://ssh.db-world.in');
  });
  it.each([
    'javascript:alert(1)', 'javascript://%0aalert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>',
    'vbscript:msgbox(1)', 'ftp://example.com', 'file:///etc/passwd', 'mailto:a@b.com',
  ])('%s is plain text, not a link', (v) => {
    expect(linkTarget(v)).toBeNull();
  });
  it.each(['a b.com', 'https://exa mple.com', 'netflix', 'my bank', '', '   ', null, undefined])('%j is plain text', (v) => {
    expect(linkTarget(v)).toBeNull();
  });
});

describe('changedLabel', () => {
  it('writes a date and time for a valid timestamp', () => {
    const label = changedLabel('2026-06-15T12:00:00Z');
    expect(label).toMatch(/2026/);
    expect(label).toMatch(/\d{1,2}:\d{2}/);
  });
  it('accepts a timestamp number too', () => {
    expect(changedLabel(Date.UTC(2026, 5, 15, 12))).toMatch(/2026/);
  });
  it.each([null, undefined, '', 'not a date'])('gives nothing for %j', (v) => {
    expect(changedLabel(v)).toBe('');
  });
});

describe('purgeEach', () => {
  const httpError = (status) => Object.assign(new Error('x'), { response: { status } });

  it('purges every id and counts them', async () => {
    const purge = vi.fn().mockResolvedValue({});
    expect(await purgeEach(['a', 'b', 'c'], purge)).toEqual({ removed: 3, failed: 0 });
    expect(purge.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c']);
  });
  it('carries on past a failure and counts it', async () => {
    const purge = vi.fn((id) => (id === 'b' ? Promise.reject(httpError(500)) : Promise.resolve({})));
    expect(await purgeEach(['a', 'b', 'c'], purge)).toEqual({ removed: 2, failed: 1 });
    expect(purge).toHaveBeenCalledTimes(3);
  });
  it('counts a 404 as removed: the entry is already gone', async () => {
    const purge = vi.fn((id) => (id === 'a' ? Promise.reject(httpError(404)) : Promise.resolve({})));
    expect(await purgeEach(['a', 'b'], purge)).toEqual({ removed: 2, failed: 0 });
  });
  it('counts an error with no response (network down) as failed', async () => {
    expect(await purgeEach(['a'], () => Promise.reject(new Error('Network Error')))).toEqual({ removed: 0, failed: 1 });
  });
  it('does nothing for no ids', async () => {
    expect(await purgeEach([], vi.fn())).toEqual({ removed: 0, failed: 0 });
  });
});
