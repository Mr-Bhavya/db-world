import { describe, it, expect } from 'vitest';

import PAGES, { pageContent, pageMeta, sectionList } from './siteContent';

/**
 * Guards on the shared editorial copy.
 *
 * This file and its Java counterpart are the fix for Google's September 2026 AdSense
 * rejection ("low value content", and ads on screens with no publisher content), and
 * every one of these failures is silent in production:
 *
 *  - a page key that stops resolving takes an editorial block off the page, and with it
 *    the `ready` gate that lets that page's ad render at all;
 *  - a renamed section `id` empties the IPO glossary or FAQ without erroring, because
 *    both adapters just map over an empty array;
 *  - a section with neither `paragraphs` nor `list` renders as a bare heading in both
 *    renderers.
 *
 * Importing at all also proves the cross-directory `@content` alias resolves — the copy
 * lives in backend resources so the crawler renderer can read the same file.
 */

/** Every page that a component or the ad gate depends on by name. */
const REQUIRED_PAGES = ['home', 'weather', 'games', 'cinema', 'ipo', 'about'];

describe('site content', () => {
  it('has every page the app asks for by name', () => {
    expect(Object.keys(PAGES)).toEqual(expect.arrayContaining(REQUIRED_PAGES));
  });

  it.each(REQUIRED_PAGES)('%s has the fields both renderers need', (key) => {
    const page = pageContent(key);

    expect(page).toBeTruthy();
    expect(page.title?.trim()).toBeTruthy();
    expect(page.description?.trim()).toBeTruthy();
    expect(page.h1?.trim()).toBeTruthy();
    expect(page.sections.length).toBeGreaterThan(0);
  });

  it.each(REQUIRED_PAGES)('%s has no section that would render as a bare heading', (key) => {
    for (const section of pageContent(key).sections) {
      expect(section.heading?.trim(), `heading missing in ${key}`).toBeTruthy();
      expect(
        (section.paragraphs?.length ?? 0) + (section.list?.length ?? 0),
        `section "${section.heading}" in ${key} has no body`,
      ).toBeGreaterThan(0);
    }
  });

  it.each(REQUIRED_PAGES)('%s carries enough copy to be worth crawling', (key) => {
    const page = pageContent(key);
    const words = [
      page.lead ?? '',
      ...page.sections.flatMap((s) => [
        s.heading,
        ...(s.paragraphs ?? []),
        ...(s.list ?? []).flatMap((i) => [i.term, i.text]),
      ]),
    ].join(' ').trim().split(/\s+/).length;

    // A substance check, not a smoke test. "Low value content" is a judgement about
    // how much there is to read, so a page hollowed out to a sentence has to fail
    // here — it would satisfy every structural assertion above.
    expect(words, `${key} is thin (${words} words)`).toBeGreaterThan(250);
  });

  it('gives the ad gate something truthy on every ad-bearing page', () => {
    // AdSlot renders nothing unless its host page reports content. These four pass
    // `pageContent(key)?.sections?.length` straight into `ready`.
    for (const key of ['home', 'weather', 'games', 'cinema']) {
      expect(Boolean(pageContent(key)?.sections?.length)).toBe(true);
    }
  });
});

describe('pageMeta', () => {
  it('returns the title and description for a known page', () => {
    expect(pageMeta('weather').title).toContain('Weather');
    expect(pageMeta('weather').description?.length).toBeGreaterThan(0);
  });

  it('returns undefined fields for an unknown page rather than throwing', () => {
    expect(pageMeta('nope')).toEqual({ title: undefined, description: undefined });
  });
});

describe('pageContent', () => {
  it('returns null for an unknown page so a caller degrades to no block', () => {
    expect(pageContent('nope')).toBeNull();
  });
});

describe('sectionList', () => {
  // IpoFaq and IpoLearn read these two by id. A rename here empties them silently.
  it('resolves the IPO FAQ', () => {
    const faq = sectionList('ipo', 'faq');

    expect(faq.length).toBeGreaterThanOrEqual(6);
    for (const item of faq) {
      expect(item.term?.trim()).toBeTruthy();
      expect(item.text?.trim()).toBeTruthy();
    }
  });

  it('resolves the IPO glossary', () => {
    const glossary = sectionList('ipo', 'glossary');

    expect(glossary.length).toBeGreaterThanOrEqual(20);
    expect(glossary.map((t) => t.term)).toEqual(expect.arrayContaining(['GMP', 'ASBA', 'DRHP']));
  });

  it('returns an empty array for an unknown page or section', () => {
    expect(sectionList('ipo', 'no-such-section')).toEqual([]);
    expect(sectionList('nope', 'faq')).toEqual([]);
  });
});
