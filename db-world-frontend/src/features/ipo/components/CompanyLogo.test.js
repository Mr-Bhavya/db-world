import { describe, it, expect } from 'vitest';
import { resolveLogoSrc } from './CompanyLogo';
import { LOGODEV_TOKEN } from '../config';

const logoDevUrl = (domain) => `https://img.logo.dev/${domain}?token=${LOGODEV_TOKEN}&size=128&format=png`;

describe('resolveLogoSrc', () => {
  it('ignores a dead logo.clearbit.com logoUrl and falls through to the Logo.dev URL built from logoDomain', () => {
    expect(resolveLogoSrc('https://logo.clearbit.com/zomato.com', 'zomato.com')).toBe(logoDevUrl('zomato.com'));
  });

  it('also rejects other clearbit.com subdomains, not just logo.clearbit.com', () => {
    expect(resolveLogoSrc('https://assets.clearbit.com/zomato.com/logo', 'zomato.com')).toBe(logoDevUrl('zomato.com'));
  });

  it('prefers a usable non-Clearbit logoUrl over logoDomain', () => {
    expect(resolveLogoSrc('https://cdn.example.com/zomato.png', 'zomato.com'))
      .toBe('https://cdn.example.com/zomato.png');
  });

  it('falls back to logoDomain when logoUrl is absent', () => {
    expect(resolveLogoSrc(null, 'swiggy.com')).toBe(logoDevUrl('swiggy.com'));
    expect(resolveLogoSrc(undefined, 'swiggy.com')).toBe(logoDevUrl('swiggy.com'));
  });

  it('treats a whitespace-only logoUrl as absent', () => {
    expect(resolveLogoSrc('   ', 'zomato.com')).toBe(logoDevUrl('zomato.com'));
  });

  it('is null when neither logoUrl nor logoDomain is usable', () => {
    expect(resolveLogoSrc(null, null)).toBeNull();
    expect(resolveLogoSrc(undefined, undefined)).toBeNull();
    expect(resolveLogoSrc('', '  ')).toBeNull();
    expect(resolveLogoSrc('   ', null)).toBeNull();
  });

  it('is a no-op (uses the string as-is) for an unparseable logoUrl, same as before the Clearbit guard', () => {
    expect(resolveLogoSrc('not-a-url', null)).toBe('not-a-url');
  });
});
