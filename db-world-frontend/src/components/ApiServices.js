import axios from 'axios'
import CommonServices from './CommonServices';
import Constants from './Constants';
import axiosInstance from './Utils/AxiosInstants';
import { handleApiError } from './Utils/errorHandler';
const REACT_APP_BASEURL = process.env.REACT_APP_BASEURL;

export const doLogin = async (email, password) => {
  try {
    // Use the axiosInstance for consistency
    const response = await axios.post(`${REACT_APP_BASEURL}/api/auth/login`, { email, password });
    if (response.data?.data?.token) {
      localStorage.setItem('token', response.data.data.token);
    }
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    handleApiError(error)
    // throw error;
  }
};

export const logout = async () => {
  try {
    await axiosInstance.post('/api/auth/logout', {}, {
      _retry: true // Bypass the interceptor for logout
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.clear();
    // Redirect or update state as needed
  }
};

export const register = async (user) => {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    }, body: JSON.stringify(user)
  })
  return response.json();
}

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
    const response = await axiosInstance.get('/api/user/');
    return response.data;
  } catch (error) {
    console.error('Error fetching user details:', error);
    throw error;
  }
};

export const updateUserDetails = async (user) => {
  try {
    console.log('Updating user details:', user);
    const response = await axiosInstance.put(`/api/user/${user.userId}`, user);
    return response.data;
  } catch (error) {
    console.error('Error updating user details:', error);
    throw error;
  }
};

export const updateUserDetailsByAdmin = async (user) => {
  try {
    console.log('Updating user details:', user);
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

export const changeShowOnTopRecord = async (recordId, showOnTop) => {
  try {
    const response = await axiosInstance.put(
      `/api/admin/cinema/record/${recordId}/showOnTop=${showOnTop}`
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

export const loadDbCinemaRecordsFromUrl = async (url) => {
  try {
    const response = await axiosInstance.get(url)
    return response.data;
  } catch (error) {
    console.error('Error loading cinema records:', error);
    throw error;
  }
}

export const loadCoverRecords = async (url, params) => {
  try {
    const response = await axiosInstance.get(url, params);
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
    const response = await axiosInstance.get(`/api/cinema/record`, {
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
    const response = await axiosInstance.get(`/api/stream/media-info/file/${fileId}`);
    return response.data;
  } catch (error) {
    console.error('Error loading stream info by file:', error);
    throw error;
  }
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
export const getRecords = async () => {
  try {
    const response = await axiosInstance.get('/api/admin/cinema/record');
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

// System Utilities APIs
export const applicationLogsApi = async () => {
  try {
    const response = await axiosInstance.get('/api/utils/logs');
    return response.data;
  } catch (error) {
    console.error('Error fetching application logs:', error);
    throw error;
  }
};

export const mirror = async (body) => {
  try {
    const response = await axiosInstance.post('/api/utils/mirror', body);
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

// Event Tracking
export const saveUserEventInfo = async (event, value) => {
  try {
    const response = await axiosInstance.post('/api/event-info/', { event, value });
    return response.data;
  } catch (error) {
    console.error('Error saving user event:', error);
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