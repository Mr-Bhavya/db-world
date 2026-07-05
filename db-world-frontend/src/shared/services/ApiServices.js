import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { handleApiError } from '@shared/components/ui/utils/errorHandler';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';
const REACT_APP_BASEURL = getApiBaseUrl();

/**
 * Register a new user.
 * Throws on HTTP error so callers can handle failure.
 */
export const register = async (user) => {
  const res = await axiosInstance.post('/api/auth/register', user);
  return res.data;
};

/**
 * Log in with email + password.
 * Returns the raw ApiResponse data object; throws on failure.
 * Note: Login.js now calls axiosInstance directly — this function is kept
 * for backward compatibility with the registration page and any other callers.
 */
export const doLogin = async (email, password) => {
  const res = await axiosInstance.post('/api/auth/login', { email: email.trim().toLowerCase(), password });
  return res.data; // ApiResponse<{ token, user }>
};

/**
 * Verify the current access token.
 * Returns ApiResponse<{ username, roles }>.
 * The axios interceptor handles silent refresh if the token is expired.
 */
export const verify = async () => {
  const res = await axiosInstance.get('/api/auth/verify');
  return res.data;
};

/**
 * Revoke the refresh token on the server.
 * Succeeds even if the cookie is missing (server handles gracefully).
 */
export const logOut = async () => {
  await axiosInstance.post('/api/auth/logout', {});
};

export const findAllUsersService = async () => {
  return await axiosInstance.get(REACT_APP_BASEURL + "/api/admin/user");
}

export const deleteUser = async (userId) => {
  const response = await axiosInstance.delete(`/api/admin/user/${userId}`)
  return await response?.data;
}

export const updateDobForUser = async (dob) => {
  try {
    const response = await axiosInstance.put(`/api/user/dob=${dob}`);
    return response.data;
  } catch (error) {
    console.error('Error updating DOB:', error);
    throw error;
  }
};

export const findUserByQuery = async (query) => {
  try {
    const response = await axiosInstance.get('/api/admin/user/search', {
      params: { query, limit: 10 }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const getAllUsers = async () => {
  try {
    const response = await axiosInstance.get('/api/admin/user');
    return response.data;
  } catch (error) {
    console.error('Error fetching all users:', error);
    // handleApiError(error, );
    throw error;
  }
};

export const getUserRole = async () => {
  try {
    const response = await axiosInstance.get('/api/user/role');
    return response.data;
  } catch (error) {
    console.error('Error getting user role:', error);
    throw error;
  }
};

export const getAllUserRoles = async () => {
  try {
    const response = await axiosInstance.get('/api/role/');
    return response.data;
  } catch (error) {
    console.error('Error fetching all user roles:', error);
    throw error;
  }
};

export const getUserDetail = async () => {
  try {
    const response = await axiosInstance.get('/api/user/profile');
    return response.data;
  } catch (error) {
    console.error('Error fetching user details:', error);
    throw error;
  }
};

export const updateUserDetails = async (user) => {
  try {
    //console.log('Updating user details:', user);
    const response = await axiosInstance.put(`/api/user/${user.userId}`, user);
    return response.data;
  } catch (error) {
    console.error('Error updating user details:', error);
    throw error;
  }
};

export const changePassword = async ({ oldPassword, newPassword }) => {
  try {
    const response = await axiosInstance.patch('/api/user/change-password', { oldPassword, newPassword });
    return response.data;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

export const getLoginHistory = async () => {
  try {
    const response = await axiosInstance.get('/api/user/login-history');
    return response.data;
  } catch (error) {
    console.error('Error fetching login history:', error);
    throw error;
  }
};

export const updateUserDetailsByAdmin = async (user) => {
  try {
    //console.log('Updating user details:', user);
    const response = await axiosInstance.put(`/api/admin/user/${user.userId}`, user);
    return response.data;
  } catch (error) {
    console.error('Error updating user details:', error);
    throw error;
  }
};

export const updateUserRoleService = async (doer_id, userId, role) => {
  try {
    const response = await axiosInstance.post(`/api/admin/user/${userId}/role`, role);
    return response.data;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

export const searchTmdbByQuery = async (recordType, query, year) => {
  try {
    let response = await axiosInstance.get(`/api/admin/cinema/tmdb/${recordType}/search?q=${query}${!year || typeof (year) == "undefined" || year == "" ? "" : "&year=" + year}`)
    return response.data;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}
export const AddDbCinemaRecord = async (name, type, tmdbId) => {
  try {
    const response = await axiosInstance.post('/api/admin/cinema/record', {
      name,
      type,
      tmdbId
    });
    return response.data;
  } catch (error) {
    console.error('Error adding cinema record:', error);
    throw error;
  }
};

export const changeShowOnTopRecord = async (recordId, body) => {
  try {
    const response = await axiosInstance.put(
      `/api/admin/cinema/record/${recordId}`, body
    );
    return response.data;
  } catch (error) {
    console.error('Error updating show on top:', error);
    throw error;
  }
};

export const deleteDbCinemaRecord = async (recordId) => {
  try {
    const response = await axiosInstance.delete(
      `/api/admin/cinema/record/${recordId}`
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting cinema record:', error);
    throw error;
  }
};

export const UpdateDbCinemaRecord = async (recordId, body) => {
  try {
    const response = await axiosInstance.put(`/api/admin/cinema/record/${recordId}`, body);
    return response.data;
  } catch (error) {
    console.error('Error updating cinema record:', error);
    throw error;
  }
}

export const loadDbCinemaRecords = async (industry, type, genres, pageNumber) => {

  var api = "";
  if (industry === "all") {
    api = `/api/cinema/record/type/${type}?page=${pageNumber}`
  }
  else if (industry === "bollywood") {
    api = `/api/cinema/record/type/${type}?page=${pageNumber}&languages=hi`
  }
  else if (industry === "hollywood") {
    api = `/api/cinema/record/type/${type}?page=${pageNumber}&languages=en`
  }
  else if (industry === "korean") {
    api = `/api/cinema/record/type/${type}?page=${pageNumber}&languages=ko`
  }
  else if (industry === "south") {
    api = `/api/cinema/record/type/${type}?page=${pageNumber}&languages=ta,te,ml,kn`
  }
  else if (industry === "gujarati") {
    api = `/api/cinema/record/type/${type}?page=${pageNumber}&languages=gu`
  }

  if (genres && genres.length > 0) {
    api += `&genres=${genres.join(",")}`
  }

  const response = await axiosInstance(api, {
    method: "GET",
    credentials: "include",
    headers: {
      Authorization: 'Bearer ' + localStorage.getItem("token")
    }
  });
  return await response.json();

}

export const loadDbCinemaRecordsFromUrl = async (url, params) => {
  try {
    const response = await axiosInstance.get(url, { params })
    return response.data;
  } catch (error) {
    console.error('Error loading cinema records:', error);
    throw error;
  }
}

export const loadCoverRecords = async (url, params) => {
  try {
    const response = await axiosInstance.get(url, { params });
    return response.data;
  } catch (error) {
    console.error('Error loading cover records:', error);
    handleApiError(error);
  }
}

export const loadMyWatchlist = async (userId) => {
  try {
    const response = await axiosInstance.get(`/api/cinema/watchlist?userId=${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error loading watchlist:', error);
    throw error;
  }
}

export const searchRecord = async (query, page, size) => {
  try {
    const response = await axiosInstance.get(`/api/cinema/catalog/search`, {
      params: { q: query, page, size }
    });
    return response.data;
  } catch (error) {
    console.error('Error searching records:', error);
    throw error;
  }
};

export const adminSearchRecord = async (query) => {
  try {
    const response = await axiosInstance.get(`/api/admin/cinema/record/search`, {
      params: { q: query }
    });
    return response.data;
  } catch (error) {
    console.error('Error in admin search:', error);
    throw error;
  }
};

export const searchStreamFile = async (query) => {
  try {
    const response = await axiosInstance.get(`/api/stream/search`, {
      params: { q: query }
    });
    return response.data;
  } catch (error) {
    console.error('Error searching stream files:', error);
    throw error;
  }
};

// Stream Info APIs
export const loadStreamFileInfoByRecordId = async (recordId) => {
  try {
    const response = await axiosInstance.get(`/api/stream/media-info/${recordId}`);
    return response.data;
  } catch (error) {
    console.error('Error loading stream info by record:', error);
    throw error;
  }
};

export const loadStreamFileInfoByFiledId = async (fileId) => {
  try {
    const response = await axiosInstance.get(`/api/stream/search/media-info/file/${fileId}`);
    return response.data;
  } catch (error) {
    console.error('Error loading stream info by file:', error);
    throw error;
  }
};

export const loadStreamFileInfoByPath = async (path) => {
  try {
    const response = await axiosInstance.get('/api/stream/search/media-info', {
      params: { path }
    });
    return response.data;
  } catch (error) {
    console.error('Error loading stream info by path:', error);
    throw error;
  }
};

export const resolveMediaUrl = async (mediaFileId, type = 'ONLINE') => {
  const token = localStorage.getItem('token');
  const response = await axiosInstance.get(`/api/stream/resolve/${mediaFileId}`, {
    params: { t: token, type },
  });
  return response.data;
};

export const resolveMediaUrlByPath = async (path, type = 'ONLINE') => {
  const token = localStorage.getItem('token');
  const response = await axiosInstance.get('/api/stream/resolve', {
    params: { path, t: token, type },
  });
  return response.data;
};

// Watch-progress (resume) APIs
export const getWatchProgress = async (fileId) => {
  const response = await axiosInstance.get(`/api/cinema/progress/${encodeURIComponent(fileId)}`);
  return response.data?.data ?? null; // { fileId, positionMs, durationMs, ... } | null
};

export const saveWatchProgress = async (fileId, { positionMs, durationMs = 0, recordId, audioLang, subLang } = {}) => {
  const params = { positionMs: Math.round(positionMs || 0), durationMs: Math.round(durationMs || 0) };
  if (recordId != null)  params.recordId = recordId;
  if (audioLang)         params.audioLang = audioLang;
  if (subLang)           params.subLang = subLang;
  // keepalive-style: best effort, never block UI on it
  return axiosInstance.put(`/api/cinema/progress/${encodeURIComponent(fileId)}`, null, { params });
};

// Interaction APIs
export const likeRecord = async (recordId, userId) => {
  try {
    const response = await axiosInstance.get(`/api/cinema/record/${recordId}/like`, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('Error liking record:', error);
    throw error;
  }
};

export const unLikeRecord = async (recordId, userId) => {
  try {
    const response = await axiosInstance.get(`/api/cinema/record/${recordId}/unlike`, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('Error unliking record:', error);
    throw error;
  }
};

export const watchlistRecord = async (recordId, userId) => {
  try {
    const response = await axiosInstance.get(`/api/cinema/record/${recordId}/watchlist`, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    throw error;
  }
};

export const removeWatchlistRecord = async (recordId, userId) => {
  try {
    const response = await axiosInstance.get(`/api/cinema/record/${recordId}/unwatchlist`, {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    throw error;
  }
};

export const markRecordWatched = async (recordId) => {
  try {
    const response = await axiosInstance.get(`/api/cinema/record/${recordId}/watch`);
    return response.data;
  } catch (error) {
    console.error('Error marking as watched:', error);
    throw error;
  }
};

export const unmarkRecordWatched = async (recordId) => {
  try {
    const response = await axiosInstance.get(`/api/cinema/record/${recordId}/unwatch`);
    return response.data;
  } catch (error) {
    console.error('Error unmarking as watched:', error);
    throw error;
  }
};

// Genre API
export const getGenresList = async () => {
  try {
    const response = await axiosInstance.get(`/api/cinema/genres`);
    return response.data;
  } catch (error) {
    console.error('Error fetching genres:', error);
    throw error;
  }
};

export const getRecords = async (params) => {
  try {
    const response = await axiosInstance.get('/api/admin/cinema/record', {params});
    return response.data;
  } catch (error) {
    console.error('Error fetching records:', error);
    throw error;
  }
};


export const getRecordDetailsbyId = async (recordId) => {
  try {
    const response = await axiosInstance.get(`/api/cinema/record/${recordId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching record details:', error);
    throw error;
  }
};

export const getStreamMediaList = async (path) => {
  try {
    const response = await axiosInstance.get('/api/file-explorer/list', {
      params: { directory: path }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching stream media list:', error);
    throw error;
  }
};

// Host Management APIs
export const findAllHost = async () => {
  try {
    const response = await axiosInstance.get('/api/pm/host');
    return response.data;
  } catch (error) {
    console.error('Error fetching hosts:', error);
    throw error;
  }
};

export const deleteHostById = async (pmId) => {
  try {
    const response = await axiosInstance.delete(`/api/pm/${pmId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting host:', error);
    throw error;
  }
};

// Credential Management APIs
export const addCredential = async (credential) => {
  try {
    const response = await axiosInstance.post('/api/pm/', credential);
    return response.data;
  } catch (error) {
    console.error('Error adding credential:', error);
    throw error;
  }
};

export const updateCredential = async (pmId, credential) => {
  try {
    const response = await axiosInstance.put(`/api/pm/${pmId}`, credential);
    return response.data;
  } catch (error) {
    console.error('Error updating credential:', error);
    throw error;
  }
};

export const getCredential = async () => {
  try {
    const response = await axiosInstance.get('/api/pm/');
    return response.data;
  } catch (error) {
    console.error('Error fetching credentials:', error);
    throw error;
  }
};

export const deleteCredentialByCredentialId = async (credentialId) => {
  try {
    const response = await axiosInstance.delete(`/api/pm/credential/${credentialId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting credential:', error);
    throw error;
  }
};

// export const mirror = async (body) => {
//   try {
//     const response = await axiosInstance.post('/api/utils/mirror', body);
//     return response.data;
//   } catch (error) {
//     console.error('Error creating mirror:', error);
//     throw error;
//   }
// };

export const mirror = async (body) => {
  try {
    const response = await axiosInstance.post('/api/ingestion', body);
    return response.data;
  } catch (error) {
    console.error('Error creating mirror:', error);
    throw error;
  }
};

export const pauseMirror = async (gid) => {
  try {
    const response = await axiosInstance.post(`/api/downloads/${gid}/pause`);
    return response.data;
  } catch (error) {
    console.error('Error creating mirror:', error);
    throw error;
  }
};

export const resumeMirror = async (gid) => {
  try {
    const response = await axiosInstance.post(`/api/downloads/${gid}/resume`);
    return response.data;
  } catch (error) {
    console.error('Error creating mirror:', error);
    throw error;
  }
};

export const cancelledMirror = async (statusId) => {
  try {
    const response = await axiosInstance.delete(`/api/utils/mirror/${statusId}`);
    return response.data;
  } catch (error) {
    console.error('Error cancelling mirror:', error);
    throw error;
  }
};

export const cancelledMirrorByGID = async (gid) => {
  try {
    const response = await axiosInstance.post(`/api/downloads/${gid}/cancel`);
    return response.data;
  } catch (error) {
    console.error('Error cancelling mirror:', error);
    throw error;
  }
};

export const deleteMirror = async (statusId) => {
  try {
    const response = await axiosInstance.delete(`/api/utils/mirror/status/${statusId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting mirror:', error);
    throw error;
  }
};

export const systemInfo = async () => {
  try {
    const response = await axiosInstance.get('/api/utils/system-info');
    return response.data;
  } catch (error) {
    console.error('Error fetching system info:', error);
    throw error;
  }
};

// YouTube APIs
export const ytInfo = async (url) => {
  try {
    const response = await axiosInstance.get('/api/utils/yt/info', {
      params: { url }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching YouTube info:', error);
    throw error;
  }
};

export const ytDownload = async (body) => {
  try {
    const response = await axiosInstance.post('/api/utils/yt/download', body);
    return response.data;
  } catch (error) {
    console.error('Error downloading YouTube content:', error);
    throw error;
  }
};

// Temp File Operations
export const deleteTempFile = async () => {
  try {
    const response = await axiosInstance.delete('/api/utils/tempFiles');
    return response.data;
  } catch (error) {
    console.error('Error deleting temp files:', error);
    throw error;
  }
};

// Media File Management
export const deleteMediaFileInfoById = async (id) => {
  try {
    const response = await axiosInstance.delete(`/api/admin/stream/media-info/file/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting media file info:', error);
    throw error;
  }
};

export const cleanMediaFileInfo = async () => {
  try {
    const response = await axiosInstance.delete('/api/admin/stream/media-info');
    return response.data;
  } catch (error) {
    console.error('Error cleaning media file info:', error);
    throw error;
  }
};

// File Explorer Operations
export const renameFileApi = async (id, body) => {
  try {
    const response = await axiosInstance.put(`/api/file-explorer/${id}/rename`, body);
    return response.data;
  } catch (error) {
    console.error('Error renaming file:', error);
    throw error;
  }
};

export const moveFileApi = async (id, body) => {
  try {
    const response = await axiosInstance.put(`/api/file-explorer/${id}/move`, body);
    return response.data;
  } catch (error) {
    console.error('Error moving file:', error);
    throw error;
  }
};

export const deleteFileApi = async (id) => {
  try {
    const response = await axiosInstance.delete(`/api/file-explorer/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

export const copyFileApi = async (id, body) => {
  try {
    const response = await axiosInstance.post(`/api/file-explorer/${id}/copy`, body);
    return response.data;
  } catch (error) {
    console.error('Error copying file:', error);
    throw error;
  }
};

export const createFolderApi = async (body) => {
  try {
    const response = await axiosInstance.post(`/api/file-explorer/folder`, body);
    return response.data;
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
};

/**
* Get all recent activities (Admin only)
*/
export const getAllRecentActivitiesApi = async (params = {}) => {
  try {
    const { limit = 100, hours = 24, activityType } = params;
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      hours: hours.toString(),
      ...(activityType && { activityType })
    }).toString();

    const response = await axiosInstance.get(`/api/user-cinema-activity/admin/all-recent?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error getting all recent activities:', error);
    throw error;
  }
}

/**
 * Get activities for a specific user (Admin only)
 */
export const getUserActivitiesApi = async (userEmail, params = {}) => {
  try {
    const { limit = 50, hours = 24, activityType } = params;
    const queryParams = new URLSearchParams({
      userEmail,
      limit: limit.toString(),
      hours: hours.toString(),
      ...(activityType && { activityType })
    }).toString();

    const response = await axiosInstance.get(`/api/user-cinema-activity/admin/user-activities?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error getting user activities:', error);
    throw error;
  }
};

/**
 * Get activity statistics for all users (Admin only)
 */
export const getActivityStatsAllApi = async (days = 7) => {
  try {
    const response = await axiosInstance.get(`/api/user-cinema-activity/admin/activity-stats?days=${days}`);
    return response.data;
  } catch (error) {
    console.error('Error getting activity stats:', error);
    throw error;
  }
};

/**
 * Get active users list (Admin only)
 */
export const getUserListApi = async (hours = 24) => {
  try {
    const response = await axiosInstance.get(`/api/user-cinema-activity/admin/user-list?hours=${hours}`);
    return response.data;
  } catch (error) {
    console.error('Error getting user list:', error);
    throw error;
  }
};

/**
 * Get dashboard statistics (Admin only)
 */
export const getDashboardStatsApi = async (days = 7) => {
  try {
    const response = await axiosInstance.get(`/api/user-cinema-activity/admin/dashboard-stats?days=${days}`);
    return response.data;
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    throw error;
  }
};

// User Endpoints

/**
 * Get current user's activities
 */
export const getMyActivitiesApi = async (params = {}) => {
  try {
    const { limit = 50, hours = 24, activityType } = params;
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      hours: hours.toString(),
      ...(activityType && { activityType })
    }).toString();

    const response = await axiosInstance.get(`/api/user-cinema-activity/user/my-activities?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error getting my activities:', error);
    throw error;
  }
};

/**
 * Get initial data (user role and basic info)
 */
export const getInitialDataApi = async () => {
  try {
    const response = await axiosInstance.get('/api/user-cinema-activity/initial-data');
    return response.data;
  } catch (error) {
    console.error('Error getting initial data:', error);
    throw error;
  }
};

/**
 * Get total activities count (Admin only)
 */
export const getTotalActivitiesCountApi = async (hours = 24) => {
  try {
    const response = await axiosInstance.get(`/api/user-cinema-activity/admin/total-count?hours=${hours}`);
    return response.data;
  } catch (error) {
    console.error('Error getting total activities count:', error);
    throw error;
  }
};

/**
 * Get active users count (Admin only)
 */
export const getActiveUsersCountApi = async (hours = 24) => {
  try {
    const response = await axiosInstance.get(`/api/user-cinema-activity/admin/active-users-count?hours=${hours}`);
    return response.data;
  } catch (error) {
    console.error('Error getting active users count:', error);
    throw error;
  }
};

// Activity Management (if needed in future)

/**
 * Create a new activity (for tracking user actions)
 */
export const createActivityApi = async (activityData) => {
  try {
    const response = await axiosInstance.post('/api/user-cinema-activity', activityData);
    return response.data;
  } catch (error) {
    console.error('Error creating activity:', error);
    throw error;
  }
};

/**
 * Get activity by ID
 */
export const getActivityByIdApi = async (id) => {
  try {
    const response = await axiosInstance.get(`/api/user-cinema-activity/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error getting activity by ID:', error);
    throw error;
  }
};

/**
 * Delete activity (Admin only)
 */
export const deleteActivityApi = async (id) => {
  try {
    const response = await axiosInstance.delete(`/api/user-cinema-activity/admin/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting activity:', error);
    throw error;
  }
};

/**
 * Bulk delete activities (Admin only)
 */
export const bulkDeleteActivitiesApi = async (activityIds) => {
  try {
    const response = await axiosInstance.post('/api/user-cinema-activity/admin/bulk-delete', { activityIds });
    return response.data;
  } catch (error) {
    console.error('Error bulk deleting activities:', error);
    throw error;
  }
};

// Analytics Endpoints

/**
 * Get activity trends over time
 */
export const getActivityTrendsApi = async (params = {}) => {
  try {
    const { days = 7, groupBy = 'day' } = params;
    const queryParams = new URLSearchParams({
      days: days.toString(),
      groupBy
    }).toString();

    const response = await axiosInstance.get(`/api/user-cinema-activity/admin/activity-trends?${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error getting activity trends:', error);
    throw error;
  }
};

/**
 * Get user activity summary
 */
export const getUserActivitySummaryApi = async (userId, days = 7) => {
  try {
    const response = await axiosInstance.get(`/api/user-cinema-activity/admin/user-summary/${userId}?days=${days}`);
    return response.data;
  } catch (error) {
    console.error('Error getting user activity summary:', error);
    throw error;
  }
};

/**
 * MEDIA FILES MANAGEMENT API
 */

/**
 * Get all media files
 */
export const getAllMediaFilesApi = async () => {
  try {
    const response = await axiosInstance.get('/api/admin/media/files');
    return response.data;
  } catch (error) {
    console.error('Error getting media files:', error);
    throw error;
  }
};

/**
 * Get media file by ID
 */
export const getMediaFileByIdApi = async (id) => {
  try {
    const response = await axiosInstance.get(`/api/admin/media/files/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting media file ${id}:`, error);
    throw error;
  }
};

/**
 * Delete single media file
 */
export const deleteMediaFileApi = async (id) => {
  try {
    const response = await axiosInstance.delete(`/api/admin/media/files/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting media file ${id}:`, error);
    throw error;
  }
};

/**
 * Delete multiple media files
 */
export const deleteMediaFilesApi = async (ids) => {
  try {
    const response = await axiosInstance.delete('/api/admin/media/files', {
      data: ids
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting media files:', error);
    throw error;
  }
};

/**
 * Cleanup media files
 */
export const cleanupMediaFilesApi = async () => {
  try {
    const response = await axiosInstance.post('/api/admin/media/files/cleanup');
    return response.data;
  } catch (error) {
    console.error('Error cleaning up media files:', error);
    throw error;
  }
};

/**
 * Repair all symlinks
 */
export const repairAllSymlinksApi = async (dryRun = false) => {
  try {
    const response = await axiosInstance.post(`/api/admin/media/symlinks/repair?dryRun=${dryRun}`);
    return response.data;
  } catch (error) {
    console.error('Error repairing all symlinks:', error);
    throw error;
  }
};

/**
 * Repair single symlink
 */
export const repairSymlinkApi = async (fileId, dryRun = false) => {
  try {
    const response = await axiosInstance.post(`/api/admin/media/symlinks/repair/${fileId}?dryRun=${dryRun}`);
    return response.data;
  } catch (error) {
    console.error(`Error repairing symlink ${fileId}:`, error);
    throw error;
  }
};

/**
 * Rebuild all symlinks
 */
export const rebuildAllSymlinksApi = async () => {
  try {
    const response = await axiosInstance.post('/api/admin/media/symlinks/rebuild');
    return response.data;
  } catch (error) {
    console.error('Error rebuilding all symlinks:', error);
    throw error;
  }
};

/**
 * Logs
 */
export const getLogs = async (url, params, signal) => {
  try {
    const response = await axiosInstance.get(url, {params,signal});
    return response.data;
  } catch (error) {
    console.error('Error rebuilding all symlinks:', error);
    throw error;
  }
};

/**
 * Client event-ingest (telemetry). Fire-and-forget: errors are swallowed so a
 * tracking failure never disrupts the UX (download/stream/search flows).
 */
export const postTrackEvents = (events) =>
  axiosInstance
    .post('/api/track/events', { events }, { headers: { 'X-DbWorld-Client': 'app' } })
    .then(r => r.data)
    .catch(() => {});
