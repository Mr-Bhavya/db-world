import axios from 'axios';
import Constants from '@shared/constants';

const REACT_APP_BASEURL = import.meta.env.VITE_API_BASE_URL || '';

// Configuration
const MAX_REFRESH_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000; // 1 second base delay
const MAX_RETRY_DELAY_MS = 30000; // 30 seconds maximum delay

// Refresh state management
let isRefreshing = false;
let failedRequestsQueue = [];
let refreshTokenAttempts = 0;

const axiosInstance = axios.create({
    baseURL: REACT_APP_BASEURL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Helper function to calculate exponential backoff delay
const calculateRetryDelay = (attempt) => 
    Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);

// Process queued requests
const processQueue = (error, token = null) => {
    failedRequestsQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedRequestsQueue = [];
};

// Cleanup queue on navigation or component unmount
const cleanupQueue = () => {
    processQueue(new Error('Session expired or navigation occurred'));
    window.removeEventListener('beforeunload', cleanupQueue);
};

// Token refresh with exponential backoff
const refreshTokenWithRetry = async () => {
    try {
        const refreshResponse = await axios.post(
            `${REACT_APP_BASEURL}/api/auth/refresh-token`,
            {},
            { withCredentials: true }
        );
        
        if (!refreshResponse.data?.data?.accessToken) {
            throw new Error('No access token in refresh response');
        }
        
        return refreshResponse.data.data.accessToken;
    } catch (error) {
        if (refreshTokenAttempts < MAX_REFRESH_RETRIES) {
            refreshTokenAttempts++;
            const retryDelay = calculateRetryDelay(refreshTokenAttempts);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return refreshTokenWithRetry();
        }
        throw error;
    }
};

// Public auth endpoints that must NOT carry a stale/expired access token.
// Spring Security's JWT decoder rejects requests with invalid Bearer tokens
// with 401 even for permitAll() paths, so we skip the header entirely for these.
// /api/auth/verify and /api/auth/logout still need the token — excluded below.
const NO_TOKEN_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh-token'];

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
    (config) => {
        const skipToken = NO_TOKEN_PATHS.some(p => config.url?.includes(p));
        if (!skipToken) {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Only handle 401/403 errors on endpoints that should carry a token.
        // NO_TOKEN_PATHS (login, register, refresh-token) are public — a 401 from them
        // means bad credentials or an expired refresh cookie, not a stale access token,
        // so we must not attempt a refresh loop.
        // /api/auth/verify DOES carry a token and SHOULD trigger refresh on 401.
        const isNoTokenPath = NO_TOKEN_PATHS.some(p => originalRequest.url?.includes(p));
        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry && !isNoTokenPath) {
            
            // If refresh is already in progress, add to queue
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedRequestsQueue.push({ resolve, reject });
                })
                .then((token) => {
                    originalRequest.headers['Authorization'] = `Bearer ${token}`;
                    return axiosInstance(originalRequest);
                })
                .catch((err) => Promise.reject(err));
            }

            // Mark request as retried and start refresh process
            originalRequest._retry = true;
            isRefreshing = true;
            window.addEventListener('beforeunload', cleanupQueue);

            try {
                const newToken = await refreshTokenWithRetry();
                localStorage.setItem('token', newToken);
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                
                // Process queued requests with new token
                processQueue(null, newToken);
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                // Process queued requests with error
                processQueue(refreshError, null);
                console.error('Token refresh failed:', refreshError);

                // Clear stored credentials and let the auth context handle navigation
                // via the 'auth:force-logout' event — avoids a hard page reload.
                localStorage.clear();
                window.dispatchEvent(new CustomEvent('auth:force-logout'));
                return Promise.reject(refreshError);
            } finally {
                // Reset refresh state
                isRefreshing = false;
                refreshTokenAttempts = 0;
                window.removeEventListener('beforeunload', cleanupQueue);
            }
        }

        return Promise.reject(error);
    }
);

// Export the configured instance
export default axiosInstance;