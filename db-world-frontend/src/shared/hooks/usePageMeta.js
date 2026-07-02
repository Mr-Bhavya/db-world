import { useEffect } from 'react';

const BASE_TITLE = 'DB World';
const DEFAULT_DESCRIPTION =
  'DB World — stream, download and manage movies and TV shows, with a secure password vault, live weather and games.';

/**
 * Set the document title (and optionally the meta description) for the current
 * page, restoring the previous values on unmount. SPA-friendly, zero-dependency
 * alternative to react-helmet for a client-rendered app.
 *
 * @param {string|null|undefined} title
 *   Page title. Falsy → just the base brand ("DB World").
 * @param {object} [opts]
 * @param {string}  [opts.description]  Meta description for this page.
 * @param {boolean} [opts.exact=false]  Use `title` verbatim (skip the " — DB World" suffix).
 *   Handy for section brands, e.g. "Movies — DB Cinema".
 *
 * @example usePageMeta('Weather', { description: 'Live local weather on DB World.' });
 * @example usePageMeta('Movies — DB Cinema', { exact: true });
 */
export default function usePageMeta(title, opts = {}) {
  const { description, exact = false } = opts;

  useEffect(() => {
    const prevTitle = document.title;
    document.title = !title ? BASE_TITLE : exact ? title : `${title} — ${BASE_TITLE}`;

    let metaEl = document.querySelector('meta[name="description"]');
    const prevDesc = metaEl ? metaEl.getAttribute('content') : null;
    const nextDesc = description || null;
    if (nextDesc) {
      if (!metaEl) {
        metaEl = document.createElement('meta');
        metaEl.setAttribute('name', 'description');
        document.head.appendChild(metaEl);
      }
      metaEl.setAttribute('content', nextDesc);
    }

    return () => {
      document.title = prevTitle;
      if (nextDesc && metaEl && prevDesc !== null) {
        metaEl.setAttribute('content', prevDesc);
      }
    };
  }, [title, description, exact]);
}

export { BASE_TITLE, DEFAULT_DESCRIPTION };
