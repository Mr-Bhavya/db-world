import axiosInstance from '../../../shared/components/ui/utils/AxiosInstants';

/* ─── USER APIS ─────────────────────────────────────────────────── */

export const getAllUsers = ({ page = 0, size = 25, search = '', role = '', sortBy = 'userId', sortDir = 'desc' } = {}) =>
  axiosInstance.get('/api/user/all', {
    params: {
      page, size, sortBy, sortDir,
      ...(search && { search }),
      ...(role && role !== 'ALL' && { role }),
    },
  }).then(r => r.data.data);

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

/** Toggle whether a record is excluded from rails (search visibility unchanged). */
export const setRecordVisibility = (id, hideFromRails) =>
  axiosInstance
    .patch(`/api/cinema/admin/catalog/${id}/visibility`, null, { params: { hideFromRails } })
    .then(r => r.data.data);

export const updateRecord = (id, body) =>
  axiosInstance.put(`/api/cinema/admin/catalog/${id}`, body).then(r => r.data.data);

/** Re-fetch this record's data from TMDB and update the DB. */
export const refreshRecordFromTmdb = (id) =>
  axiosInstance.post(`/api/cinema/admin/catalog/${id}/refresh`).then(r => r.data.data);

export const deleteRecord = (id) =>
  axiosInstance.delete(`/api/cinema/admin/catalog/${id}`).then(r => r.data);

// Quick add/remove by tagType (used by RecordTagsInline for inline table operations)
export const addRecordTag = (recordId, body) =>
  axiosInstance.post(`/api/cinema/admin/catalog/${recordId}/tags`, body).then(r => r.data.data);

export const removeRecordTag = (recordId, tagType) =>
  axiosInstance.delete(`/api/cinema/admin/catalog/${recordId}/tags/${tagType}`).then(r => r.data);

// Full tag CRUD by tagId — supports priority field (used by RecordEditModal for full management)
export const createTag = (recordId, body) =>
  axiosInstance.post(`/api/cinema/admin/tags/record/${recordId}`, body).then(r => r.data.data);

export const updateTag = (tagId, body) =>
  axiosInstance.put(`/api/cinema/admin/tags/entry/${tagId}`, body).then(r => r.data.data);

export const deleteTag = (tagId) =>
  axiosInstance.delete(`/api/cinema/admin/tags/entry/${tagId}`).then(r => r.data);

/* ─── TMDB SEARCH & DETAIL ──────────────────────────────────────── */

export const searchTmdb = (type, query, year, language = 'en-US') =>
  axiosInstance.get('/api/cinema/admin/tmdb/search', { params: { type, query, year, language } }).then(r => r.data.data);

export const getTmdbDetail = (type, tmdbId) => {
  const seg = type === 'MOVIE' ? 'movies' : 'tv';
  return axiosInstance.get(`/api/cinema/admin/tmdb/${seg}/${tmdbId}`).then(r => {
    // ApiResponse.success === false means a backend error slipped through as 2xx
    // (e.g. Jackson cut the body short after the 200 status was committed).
    // Throw so TanStack Query records it as an error, not as blank/null data.
    if (!r.data?.success) throw new Error(r.data?.message ?? 'Request failed');
    return r.data.data;
  });
};

/* ─── RECORD DETAIL ─────────────────────────────────────────────── */

export const getAdminRecordDetail = (recordId) =>
  axiosInstance.get(`/api/cinema/admin/catalog/${recordId}`).then(r => r.data.data);

/* ─── MEDIA FILES ───────────────────────────────────────────────── */

export const getMediaFiles = (recordId) =>
  axiosInstance.get(`/api/media/info/record/${recordId}`).then(r => r.data.data);

export const deleteMediaFile = (filePath) =>
  axiosInstance.delete('/api/media/info/path', { params: { path: filePath } }).then(r => r.data);

export const rescanMediaFile = (id) =>
  axiosInstance.post(`/api/media/info/${id}/rescan`).then(r => r.data.data);

export const seedMediaFiles = (recordId) =>
  axiosInstance.post(`/api/media/info/seed/${recordId}`).then(r => r.data.data);

// Paginated media files list — returns Spring Page { content, totalElements, totalPages, number, last }
export const getMediaFilesPaged = (params) =>
  axiosInstance.get('/api/admin/media/files', { params }).then(r => r.data.data ?? r.data);

// Aggregate stats — fast, no track data
export const getMediaFilesStats = () =>
  axiosInstance.get('/api/admin/media/files/stats').then(r => r.data.data);

// Full detail for a single file — includes all tracks + rawMediaInfo
export const getMediaFileDetail = (id) =>
  axiosInstance.get(`/api/admin/media/files/${id}`).then(r => r.data.data);

export const deleteMediaFileById = (id, purge = false) =>
  axiosInstance.delete(`/api/admin/media/files/${id}`, { params: { purge } }).then(r => r.data);

export const bulkDeleteMediaFiles = (ids, purge = false) =>
  axiosInstance.delete('/api/admin/media/files', { data: ids, params: { purge } }).then(r => r.data);

export const cleanupOrphanedFiles = () =>
  axiosInstance.post('/api/admin/media/files/cleanup').then(r => r.data);

export const repairAllSymlinks = (dryRun = false) =>
  axiosInstance.post(`/api/admin/media/symlinks/repair?dryRun=${dryRun}`).then(r => r.data);

export const repairSymlink = (fileId) =>
  axiosInstance.post(`/api/admin/media/symlinks/repair/${fileId}`).then(r => r.data);

export const rebuildAllSymlinks = () =>
  axiosInstance.post('/api/admin/media/symlinks/rebuild').then(r => r.data);

export const scanStreamMigration = () =>
  axiosInstance.post('/api/ingestion/migrate/scan-stream').then(r => r.data);

export const linkMediaFileToRecord = (mediaFileId, recordId) =>
  axiosInstance.patch(`/api/media/info/${mediaFileId}/link-record`, null, { params: { recordId } }).then(r => r.data);

export const updateMediaFileEpisode = (id, season, episode) =>
  axiosInstance.patch(`/api/admin/media/files/${id}/episode`, null, { params: { season, episode } }).then(r => r.data);

/* ─── TAG ADMIN ─────────────────────────────────────────────────── */

export const getTagSummary = () =>
  axiosInstance.get('/api/cinema/admin/tags/summary').then(r => r.data.data);

export const getRecordsByTag = (tagType, params) =>
  axiosInstance.get(`/api/cinema/admin/tags/${tagType}/records`, { params }).then(r => r.data.data);

export const bulkAddTag = (tagType, recordIds, priority = 50) =>
  axiosInstance.post(`/api/cinema/admin/tags/${tagType}/bulk-add`, { recordIds, priority }).then(r => r.data.data);

export const bulkRemoveTag = (tagType, recordIds) =>
  axiosInstance.delete(`/api/cinema/admin/tags/${tagType}/bulk-remove`, { data: { recordIds } }).then(r => r.data.data);

export const recalculateTag = (tagType) =>
  axiosInstance.post(`/api/cinema/admin/tags/${tagType}/recalculate`).then(r => r.data);

export const recalculateAllTags = () =>
  axiosInstance.post('/api/cinema/admin/tags/recalculate-all').then(r => r.data);

/* ─── TAG DEFINITIONS ───────────────────────────────────────────── */

export const getTagDefinitions = () =>
  axiosInstance.get('/api/cinema/admin/tags/definitions').then(r => r.data.data);

export const updateTagDefinition = (tagType, body) =>
  axiosInstance.put(`/api/cinema/admin/tags/definitions/${tagType}`, body).then(r => r.data.data);

/** Returns { sortFields, ruleTypes, pageTypes, recordTypes, tagTypes } */
export const getRailMetadata = () =>
  axiosInstance.get('/api/cinema/admin/tags/rail-metadata').then(r => r.data.data);

/* ─── RAILS ─────────────────────────────────────────────────────── */

export const getRails = (pageType) =>
  axiosInstance.get('/api/cinema/rails', { params: pageType ? { pageType } : undefined }).then(r => r.data.data);

export const createRail = (body) =>
  axiosInstance.post('/api/cinema/rails', body).then(r => r.data.data);

export const updateRail = (id, body) =>
  axiosInstance.put(`/api/cinema/rails/${id}`, body).then(r => r.data.data);

export const deleteRail = (id) =>
  axiosInstance.delete(`/api/cinema/rails/${id}`).then(r => r.data);

export const reorderRails = (orderedRails) =>
  Promise.all(orderedRails.map((rail, i) =>
    axiosInstance.put(`/api/cinema/rails/${rail.id}`, { ...rail, priority: i }).then(r => r.data.data)
  ));

/* ─── TMDB SYNC ─────────────────────────────────────────────── */

export const getTmdbSyncStats = () =>
  axiosInstance.get('/api/cinema/admin/tmdb/sync/stats').then(r => r.data.data);

export const getTmdbSyncRecords = (params) =>
  axiosInstance.get('/api/cinema/admin/tmdb/sync/records', { params }).then(r => r.data.data);

export const triggerTmdbSync = (type) =>
  axiosInstance.post('/api/cinema/admin/tmdb/sync/trigger', null, {
    params: type ? { type } : undefined,
  }).then(r => r.data);

export const retryTmdbSync = (id) =>
  axiosInstance.post(`/api/cinema/admin/tmdb/sync/retry/${id}`).then(r => r.data);

export const forceTmdbSync = (type) =>
  axiosInstance.post('/api/cinema/admin/tmdb/sync/force', null, {
    params: type ? { type } : undefined,
  }).then(r => r.data);

/* ─── REDIS CACHE ───────────────────────────────────────────── */

export const getRedisInfo = () =>
  axiosInstance.get('/api/admin/redis/info').then(r => r.data.data);

export const getRedisKeys = (params) =>
  axiosInstance.get('/api/admin/redis/keys', { params }).then(r => r.data.data);

export const getRedisKey = (key) =>
  axiosInstance.get('/api/admin/redis/key', { params: { key } }).then(r => r.data.data);

export const setRedisKey = (body) =>
  axiosInstance.post('/api/admin/redis/key', body).then(r => r.data);

export const updateRedisKey = (key, value) =>
  axiosInstance.put('/api/admin/redis/key', { value }, { params: { key } }).then(r => r.data);

export const updateRedisTtl = (key, ttlSeconds) =>
  axiosInstance.patch('/api/admin/redis/key/ttl', null, { params: { key, ttlSeconds } }).then(r => r.data);

export const deleteRedisKey = (key) =>
  axiosInstance.delete('/api/admin/redis/key', { params: { key } }).then(r => r.data);

export const deleteRedisKeys = (keys) =>
  axiosInstance.delete('/api/admin/redis/keys', { data: keys }).then(r => r.data);

export const flushRedisKeys = ({ pattern, confirm }) =>
  axiosInstance.delete('/api/admin/redis/flush', { params: { pattern, confirm } }).then(r => r.data);

/* ─── SYSTEM INFO ───────────────────────────────────────────── */

export const getServerInfo = () =>
  axiosInstance.get('/api/server/info').then(r => r.data.data);

export const getServerInfoQuick = () =>
  axiosInstance.get('/api/server/info/quick').then(r => r.data.data);

export const getServerHealth = () =>
  axiosInstance.get('/api/server/health').then(r => r.data.data);

export const refreshServerInfoCache = () =>
  axiosInstance.post('/api/server/cache/refresh').then(r => r.data);
