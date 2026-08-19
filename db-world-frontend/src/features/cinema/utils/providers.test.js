import { describe, it, expect } from 'vitest';
import { pickProviderRegion, providersForRegion, providerStrip } from './providers';

const p = (regionCode, providerType, name, displayPriority = 1) => ({
  regionCode, providerType, provider: { name, logoPath: `/${name}.jpg`, displayPriority },
});

describe('pickProviderRegion', () => {
  const providers = [p('US', 'FLATRATE', 'Hulu'), p('IN', 'FLATRATE', 'Jio'), p('DE', 'BUY', 'Apple')];

  it('prefers the viewer region when the title is offered there', () => {
    expect(pickProviderRegion(providers, 'DE')).toBe('DE');
  });

  it('falls back to IN, then US, then whatever exists', () => {
    expect(pickProviderRegion(providers, 'FR')).toBe('IN');
    expect(pickProviderRegion([p('US', 'FLATRATE', 'Hulu'), p('DE', 'BUY', 'Apple')], 'FR')).toBe('US');
    expect(pickProviderRegion([p('DE', 'BUY', 'Apple')], 'FR')).toBe('DE');
  });

  it('is null when the title has no providers at all', () => {
    expect(pickProviderRegion([], 'IN')).toBeNull();
    expect(pickProviderRegion(undefined, 'IN')).toBeNull();
  });
});

describe('providersForRegion', () => {
  it('keeps only the chosen region', () => {
    const providers = [p('IN', 'FLATRATE', 'Jio'), p('US', 'FLATRATE', 'Hulu')];
    expect(providersForRegion(providers, 'IN').map((x) => x.provider.name)).toEqual(['Jio']);
    expect(providersForRegion(providers, null)).toEqual([]);
  });
});

describe('providerStrip', () => {
  it('puts what you can stream before what you have to pay for', () => {
    const providers = [
      p('IN', 'BUY', 'Apple TV'),
      p('IN', 'FLATRATE', 'Netflix'),
      p('IN', 'RENT', 'YouTube'),
      p('IN', 'NETWORK', 'Star'),
    ];
    const strip = providerStrip(providers, 4, 'IN');

    expect(strip.items.map((x) => x.provider.name)).toEqual(['Netflix', 'Star', 'YouTube', 'Apple TV']);
    expect(strip.kind).toBe('FLATRATE');
  });

  it('orders within a type by TMDB display priority', () => {
    const providers = [p('IN', 'FLATRATE', 'Second', 5), p('IN', 'FLATRATE', 'First', 1)];
    expect(providerStrip(providers, 4, 'IN').items.map((x) => x.provider.name)).toEqual(['First', 'Second']);
  });

  it('de-duplicates a service listed under several types', () => {
    const providers = [p('IN', 'RENT', 'Apple TV'), p('IN', 'BUY', 'Apple TV')];
    const strip = providerStrip(providers, 4, 'IN');

    expect(strip.items).toHaveLength(1);
    expect(strip.total).toBe(1);
    expect(strip.kind).toBe('RENT');
  });

  it('reports the overflow count against the de-duplicated set', () => {
    const providers = ['A', 'B', 'C', 'D', 'E'].map((n, i) => p('IN', 'FLATRATE', n, i));
    const strip = providerStrip(providers, 3, 'IN');

    expect(strip.items).toHaveLength(3);
    expect(strip.total).toBe(5);
  });

  it('is empty rather than throwing when there are no providers', () => {
    const strip = providerStrip(undefined, 4, 'IN');
    expect(strip.items).toEqual([]);
    expect(strip.kind).toBeNull();
    expect(strip.region).toBeNull();
  });
});
