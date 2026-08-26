// Genre landing pages — URL ⇄ genre helpers.
//
// A genre page is the SECTION page filtered to one genre, so the section stays
// in the path: /db-cinema/movie/genre/28-action. That keeps the billboard
// breadcrumb ("Movies › Action") and the rails scoped exactly as they were when
// the genre was only local state, but now it is a real URL — shareable,
// refreshable, and Back-button friendly.
//
// Only the leading id is read back; the trailing name is cosmetic, the same
// convention `recordDetailPath` uses in recordNav.js.

import Constants from '@shared/constants';

const PAGE_ROUTE = {
  home:   Constants.DB_CINEMA_BROWSE_ROUTE,
  browse: Constants.DB_CINEMA_BROWSE_ROUTE,
  movies: Constants.DB_CINEMA_MOVIES_ROUTE,
  series: Constants.DB_CINEMA_SERIES_ROUTE,
};

/** Base (all genres) path for a page key. */
export const pagePath = (page) => PAGE_ROUTE[page] ?? Constants.DB_CINEMA_BROWSE_ROUTE;

/** `{ id: 28, name: 'Action' }` → `28-action` */
export const genreSlug = (genre) => {
  const name = (genre?.name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // any run of non-alphanumerics → single dash
    .replace(/^-+|-+$/g, '');    // trim leading/trailing dashes
  return name ? `${genre.id}-${name}` : String(genre?.id ?? '');
};

/** `28-action` → 28. null when the slug is missing or not id-prefixed. */
export const genreIdFromSlug = (slug) => {
  const id = Number.parseInt(String(slug ?? ''), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
};

/**
 * `10765-sci-fi-fantasy` → "Sci Fi Fantasy".
 * Placeholder only: used for the heading in the moment before the categories
 * query resolves (or when the id isn't in this page's genre list at all).
 */
export const genreNameFromSlug = (slug) => String(slug ?? '')
  .replace(/^\d+-?/, '')
  .split('-')
  .filter(Boolean)
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');

/** Landing-page path for `genre` inside `page`; the plain page path when genre is null. */
export const genrePath = (page, genre) =>
  genre ? `${pagePath(page)}/genre/${genreSlug(genre)}` : pagePath(page);
