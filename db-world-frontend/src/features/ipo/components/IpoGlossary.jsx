import { sectionList } from '@shared/content/siteContent';

/**
 * The common IPO terms a first-time applicant runs into on this site, each with a 1-line
 * plain-English definition — kept terse on purpose (this is a glossary, not an encyclopedia).
 * Ordered roughly by "how likely a reader is to meet this term first" (GMP/IPO/Mainboard/SME
 * up top since they're on every card) rather than alphabetically.
 *
 * Consumed by `IpoLearn`'s searchable "Terms" sub-tab (a dense, filterable grid). The
 * previous standalone per-term accordion section was folded into `IpoLearn` (see its git
 * history) since a search box + compact grid scales far better behind a sub-tab than ~24
 * permanently-listed accordions.
 *
 * THE TERMS THEMSELVES NOW LIVE IN `site-content.json`, not here. They were 24 of the
 * best-written paragraphs on the site and a crawler could not see one of them: the IPO
 * page's server-rendered version was a list of company names. Moving the data into the
 * shared file means `SeoRenderController` emits it too. Edit the copy there; this module
 * is only the shape adapter.
 */
export const GLOSSARY_TERMS = sectionList('ipo', 'glossary')
  // The shared file speaks {term, text}; this grid has always spoken {term, def}.
  // Mapping here keeps the rename out of IpoLearn's search and render code.
  .map(({ term, text }) => ({ term, def: text }));
