import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

const settingsApi = {
  list:   ()            => axiosInstance.get('/api/admin/config').then(r => r.data?.data ?? []),
  update: (key, value)  => axiosInstance.put(`/api/admin/config/${encodeURIComponent(key)}`, { value: String(value) }),
  reset:  (key)         => axiosInstance.post(`/api/admin/config/${encodeURIComponent(key)}/reset`),
};

export default settingsApi;
