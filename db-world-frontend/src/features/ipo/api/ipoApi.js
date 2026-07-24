import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/ipo';
const unwrap = (r) => r.data?.data ?? r.data;

/** status: one of upcoming|open|closed|listed, or omit/empty for all. */
export const getIpos = (status) =>
  axiosInstance.get(BASE, { params: status ? { status } : undefined }).then(unwrap);

export const getIpo = (id) =>
  axiosInstance.get(`${BASE}/${id}`).then(unwrap);

export const getGmpHistory = (id) =>
  axiosInstance.get(`${BASE}/${id}/gmp-history`).then(unwrap);

export const getSubscriptionHistory = (id) =>
  axiosInstance.get(`${BASE}/${id}/subscription-history`).then(unwrap);
