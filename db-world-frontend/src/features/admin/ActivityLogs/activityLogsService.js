// services/activityLogsService.js
import axios from 'axios';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const fetchActivityLogs = async (params = {}) => {
  const queryParams = {
    page: params.page || 0,
    size: params.size || 10,
    sort: 'timestamp,desc',
    ...params
  };

  // Remove undefined or null values
  Object.keys(queryParams).forEach(key => {
    if (queryParams[key] === undefined || queryParams[key] === null) {
      delete queryParams[key];
    }
  });

  return await axiosInstance.get('/api/admin/activity-logs', {
    params: queryParams,
    paramsSerializer: {
      indexes: null // No array indexes in params
    }
  });
};

export const fetchUsernames = async (query = '') => {
  return await axiosInstance.get('/api/admin/user/search', {
    params: { query }
  });
};