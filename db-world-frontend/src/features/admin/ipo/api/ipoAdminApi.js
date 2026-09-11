import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/admin/ipo';
const unwrap = (r) => r.data?.data ?? r.data;

export const getSourceHealth = () => axiosInstance.get(`${BASE}/sources`).then(unwrap);
export const getIpoChanges = () => axiosInstance.get(`${BASE}/changes`).then(unwrap);
export const repoll = () => axiosInstance.post(`${BASE}/repoll`).then((r) => r.data);

// Duplicate listings. GET is a DRY RUN — it proposes clusters and changes nothing. POST applies
// them: omit `aliasKeys` to merge every proposed cluster, or pass a subset to approve only some.
export const getIpoDuplicates = () => axiosInstance.get(`${BASE}/duplicates`).then(unwrap);
export const mergeIpoDuplicates = (aliasKeys) =>
  axiosInstance.post(`${BASE}/duplicates/merge`, aliasKeys ?? null).then((r) => r.data);

// Push utilities are app-agnostic (endpoint /api/admin/push), surfaced here since this is where
// push is currently exercised. `body` is optional { title, body, link }.
const PUSH_BASE = '/api/admin/push';
export const getPushStatus = () => axiosInstance.get(`${PUSH_BASE}/status`).then(unwrap);
export const sendTestPush = (body = {}) => axiosInstance.post(`${PUSH_BASE}/test`, body).then((r) => r.data);
