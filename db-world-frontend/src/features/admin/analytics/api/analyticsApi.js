import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/admin/analytics';

const unwrap = (r) => r.data?.data ?? r.data;

export const fetchOverview = () =>
  axiosInstance.get(`${BASE}/overview`).then(unwrap);

export const fetchTrend = (days = 30) =>
  axiosInstance.get(`${BASE}/trend`, { params: { days } }).then(unwrap);

export const fetchClientBreakdown = () =>
  axiosInstance.get(`${BASE}/client-breakdown`).then(unwrap);

export const fetchTopRecords = (limit = 20) =>
  axiosInstance.get(`${BASE}/top-records`, { params: { limit } }).then(unwrap);

export const fetchTopUsers = (limit = 20) =>
  axiosInstance.get(`${BASE}/top-users`, { params: { limit } }).then(unwrap);
