import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/me/tracking';

const unwrap = (r) => r.data?.data ?? r.data;

/** GET /api/me/tracking/summary → MeActivitySummaryDto */
export const fetchMyActivitySummary = () =>
  axiosInstance.get(`${BASE}/summary`).then(unwrap);

/**
 * GET /api/me/tracking/timeline?activity=&page=&size=&sort=lastEventAt,desc
 * → Page<MeSessionDto>. `type` maps to the `activity` query param (ActivityKind:
 * DOWNLOAD/STREAM/SEARCH). Sort is always pinned to newest-first since the
 * backend does not default the ordering itself.
 */
export const fetchMyActivities = ({ type, page = 0, size = 20 } = {}) =>
  axiosInstance
    .get(`${BASE}/timeline`, { params: { activity: type || undefined, page, size, sort: 'lastEventAt,desc' } })
    .then(unwrap);
