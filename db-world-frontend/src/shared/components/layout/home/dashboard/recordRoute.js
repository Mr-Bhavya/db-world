import Constants from '@shared/constants';

const SERIES_TYPES = ['TV_SERIES', 'SERIES', 'TV'];

/**
 * The detail-page path for a catalog record.
 *
 * The route parameter is `{id}-{slug}` when an id is known — the id is what the page resolves on,
 * the slug is there for the URL to be readable and shareable.
 */
export const recordRoute = (recordType, recordTitle, recordId) => {
  const slug = (recordTitle ?? '').trim().replace(/\s+/g, '-').toLowerCase();
  const param = recordId ? `${recordId}-${slug}` : encodeURIComponent(recordTitle ?? '');
  const isSeries = SERIES_TYPES.includes((recordType ?? '').toUpperCase());

  return isSeries
    ? Constants.DB_SERIES_DETIALS_ROUTE.replace(':title', param)
    : Constants.DB_MOVIE_DETIALS_ROUTE.replace(':title', param);
};

export default recordRoute;
