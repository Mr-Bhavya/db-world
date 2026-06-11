// Centralised navigation into a record's detail view.
//
// Every entry point (rail card, hover popup, hero banner) routes through here
// so they all behave identically: the URL updates to the detail route AND
// `location.state.background` is set to the current location. App.jsx detects
// `background` and mounts the detail as an OVERLAY (bottom sheet on mobile,
// centered modal on desktop) over the still-mounted page underneath — so the
// page never unmounts, never refetches, and keeps its scroll position.
//
// `cardRecord` carries a lightweight summary (poster/title) so the overlay can
// paint an instant hero before the full record query resolves (no grey flash).

import Constants from '@shared/constants';

export const recordDetailPath = (record) => {
  const base = record?.type === 'MOVIE'
    ? Constants.DB_MOVIE_DETIALS_ROUTE
    : Constants.DB_SERIES_DETIALS_ROUTE;
  const slug = `${record.id}-${(record.title ?? record.name ?? '').replace(/\s+/g, '-').toLowerCase()}`;
  return base.replace(':title', slug);
};

// Minimal poster/title summary for the instant-hero placeholder.
export const cardPreview = (record) => ({
  id:           record.id,
  title:        record.title ?? record.name,
  type:         record.type,
  posterPath:   record.posterPath   ?? record.posterPathClean ?? null,
  backdropPath: record.backdropPath ?? record.backdropPathText ?? null,
  voteAverage:  record.voteAverage,
  releaseDate:  record.releaseDate,
});

/**
 * Navigate to a record's detail as an overlay.
 * @param navigate  react-router navigate fn
 * @param location  current useLocation() value (becomes the background)
 * @param record    the rail/card/hero record
 * @param opts.play       when true, deep-links to the Watch section
 * @param opts.originRect { top,left,width,height } of the control that opened it;
 *                        the desktop modal grows from this point.
 */
export const openRecord = (navigate, location, record, { play = false, originRect = null } = {}) => {
  if (!record) return;
  navigate(recordDetailPath(record), {
    state: {
      background: location,
      cardRecord: cardPreview(record),
      ...(play ? { defaultTab: 'Watch' } : {}),
      ...(originRect ? { originRect } : {}),
    },
  });
};

/** Serialise a DOMRect to a plain object safe for router state. */
export const rectOf = (el) => {
  const r = el?.getBoundingClientRect?.();
  return r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
};

// Warm the lazy detail chunks so the desktop modal opens instantly on click
// (importing the modal pulls in RecordDetailContent, its only heavy dep).
let _preloaded = false;
export const preloadDetail = () => {
  if (_preloaded) return;
  _preloaded = true;
  import('@features/cinema/screens/RecordDetailPage/RecordDetailModal.jsx').catch(() => { _preloaded = false; });
};
