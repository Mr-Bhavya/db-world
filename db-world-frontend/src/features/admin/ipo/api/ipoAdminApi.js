import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/admin/ipo';
const unwrap = (r) => r.data?.data ?? r.data;

export const getSourceHealth = () => axiosInstance.get(`${BASE}/sources`).then(unwrap);
export const getIpoChanges = () => axiosInstance.get(`${BASE}/changes`).then(unwrap);
export const repoll = () => axiosInstance.post(`${BASE}/repoll`).then((r) => r.data);
