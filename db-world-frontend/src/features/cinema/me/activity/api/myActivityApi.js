import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/me/activity';

const unwrap = (r) => r.data?.data ?? r.data;

/** GET /api/me/activity/summary → MyActivitySummaryDto */
export const fetchMyActivitySummary = () =>
  axiosInstance.get(`${BASE}/summary`).then(unwrap);

/** GET /api/me/activity/top-rewatches?limit=N → TopRewatchDto[] */
export const fetchTopRewatches = (limit = 6) =>
  axiosInstance.get(`${BASE}/top-rewatches`, { params: { limit } }).then(unwrap);

/** GET /api/me/activity?type=&page=&size= → UserActivityViewDto[] */
export const fetchMyActivities = ({ type, page = 0, size = 20 } = {}) =>
  axiosInstance.get(BASE, { params: { type, page, size } }).then(unwrap);
