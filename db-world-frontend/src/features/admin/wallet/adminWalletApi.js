import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/admin/wallet';
const unwrap = (r) => r.data?.data ?? r.data;

export const fetchTypes = () => axiosInstance.get(`${BASE}/types`).then(unwrap);
export const createType = (body) => axiosInstance.post(`${BASE}/types`, body).then(unwrap);
export const updateType = (id, body) => axiosInstance.put(`${BASE}/types/${id}`, body).then(unwrap);
export const deleteType = (id) => axiosInstance.delete(`${BASE}/types/${id}`).then((r) => r.data);
export const fetchStats = () => axiosInstance.get(`${BASE}/stats`).then(unwrap);

// max-size / allowed-types live in the shared app_config surface:
export const fetchConfig = () => axiosInstance.get('/api/admin/config').then(unwrap);
export const updateConfig = (key, value) => axiosInstance.put(`/api/admin/config/${encodeURIComponent(key)}`, { value }).then(unwrap);
