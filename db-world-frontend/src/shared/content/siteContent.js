import content from '@content';

/**
 * Editorial copy for the public pages.
 *
 * The JSON behind `@content` is shared with the backend — see the header comment in
 * `db-world-backend/src/main/resources/site-content.json` for why. It is imported, not
 * fetched, so the words are in the initial bundle: a crawler that renders our
 * JavaScript sees them without a second round trip, and a visitor never watches them
 * pop in.
 *
 * @typedef {{ term: string, text: string }} ContentTerm
 * @typedef {{ id?: string, heading: string, paragraphs?: string[], list?: ContentTerm[] }} ContentSection
 * @typedef {{ h1: string, title: string, description: string, lead: string,
 *             sections: ContentSection[] }} PageContent
 */

const PAGES = content?.pages ?? {};

/**
 * Copy for one page key, or null when there is none.
 *
 * Returns null rather than throwing: a missing key must degrade to a page without an
 * editorial block, never to a blank screen.
 *
 * @param {string} key
 * @returns {PageContent | null}
 */
export const pageContent = (key) => PAGES[key] ?? null;

/**
 * Just the `<title>` / meta description pair, for `usePageMeta`.
 *
 * @param {string} key
 * @returns {{ title: string | undefined, description: string | undefined }}
 */
export const pageMeta = (key) => {
  const page = PAGES[key];
  return { title: page?.title, description: page?.description };
};

/**
 * One section's term/definition list, by the section's stable `id`.
 *
 * For components that render a specific section their own way rather than through
 * `EditorialSections` — the IPO FAQ accordion and the searchable glossary grid both do.
 * Looked up by `id`, never by heading: a heading is prose and will be reworded.
 *
 * @param {string} pageKey
 * @param {string} sectionId
 * @returns {ContentTerm[]} empty when the page or section is missing
 */
export const sectionList = (pageKey, sectionId) =>
  PAGES[pageKey]?.sections?.find((section) => section.id === sectionId)?.list ?? [];

export default PAGES;
