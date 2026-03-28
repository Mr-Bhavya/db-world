import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

/* ─── USER APIS ─────────────────────────────────────────────────── */

export const getAllUsers = () =>
  axiosInstance.get('/api/user/all').then(r => r.data.data);

export const getUserById = (userId) =>
  axiosInstance.get(`/api/user/${userId}`).then(r => r.data.data);

export const createUser = (body) =>
  axiosInstance.post('/api/user', body).then(r => r.data.data);

export const bulkCreateUsers = (body) =>
  axiosInstance.post('/api/user/bulk', body).then(r => r.data.data);

export const updateUser = (userId, body) =>
  axiosInstance.put(`/api/user/${userId}`, body).then(r => r.data.data);

export const updateUserRole = (userId, roleId) =>
  axiosInstance.patch(`/api/user/${userId}/role`, null, { params: { roleId } }).then(r => r.data.data);

export const deleteUser = (userId) =>
  axiosInstance.delete(`/api/user/${userId}`).then(r => r.data);

export const changePassword = (body) =>
  axiosInstance.patch('/api/user/change-password', body).then(r => r.data);

export const searchUsers = (q, limit = 5) =>
  axiosInstance.get('/api/user/search', { params: { q, limit } }).then(r => r.data.data);

/* ─── RECORD APIS ───────────────────────────────────────────────── */

export const getRecordsTable = (params) =>
  axiosInstance.get('/api/cinema/admin/catalog/table', { params }).then(r => r.data.data);

export const createRecord = (body) =>
  axiosInstance.post('/api/cinema/admin/catalog', body).then(r => r.data.data);

export const updateRecord = (id, body) =>
  axiosInstance.put(`/api/cinema/admin/catalog/${id}`, body).then(r => r.data.data);

export const deleteRecord = (id) =>
  axiosInstance.delete(`/api/cinema/admin/catalog/${id}`).then(r => r.data);

// Quick add/remove by tagType (used by RecordTagsInline for inline table operations)
export const addRecordTag = (recordId, body) =>
  axiosInstance.post(`/api/cinema/admin/catalog/${recordId}/tags`, body).then(r => r.data.data);

export const removeRecordTag = (recordId, tagType) =>
  axiosInstance.delete(`/api/cinema/admin/catalog/${recordId}/tags/${tagType}`).then(r => r.data);

// Full tag CRUD by tagId — supports priority field (used by RecordEditModal for full management)
export const createTag = (recordId, body) =>
  axiosInstance.post(`/api/cinema/admin/catalog/tags/${recordId}`, body).then(r => r.data.data);

export const updateTag = (tagId, body) =>
  axiosInstance.put(`/api/cinema/admin/catalog/tags/${tagId}`, body).then(r => r.data.data);

export const deleteTag = (tagId) =>
  axiosInstance.delete(`/api/cinema/admin/catalog/tags/${tagId}`).then(r => r.data);

/* ─── TMDB SEARCH ───────────────────────────────────────────────── */

export const searchTmdb = (type, query, year) =>
  axiosInstance.get('/api/tmdb/search', { params: { type, query, year } }).then(r => r.data.data);
