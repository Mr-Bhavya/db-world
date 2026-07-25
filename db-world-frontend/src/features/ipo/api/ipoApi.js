import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/ipo';
const unwrap = (r) => r.data?.data ?? r.data;

/**
 * List IPOs.
 * - status: canonical upcoming|open|closed|listed; omitted when falsy (= all).
 * - type: mainboard|sme; omitted when falsy or 'all' (= all).
 * - sort: date (default) | gmp | subscription — always sent.
 */
export const getIpos = ({ status, type, sort = 'date' } = {}) => {
  const params = { sort };
  if (status) params.status = status;
  if (type && type !== 'all') params.type = type;
  return axiosInstance.get(BASE, { params }).then(unwrap);
};

export const getIpo = (id) =>
  axiosInstance.get(`${BASE}/${id}`).then(unwrap);

export const getGmpHistory = (id) =>
  axiosInstance.get(`${BASE}/${id}/gmp-history`).then(unwrap);

export const getSubscriptionHistory = (id) =>
  axiosInstance.get(`${BASE}/${id}/subscription-history`).then(unwrap);
