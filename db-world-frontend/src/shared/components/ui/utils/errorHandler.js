import Constants from '@shared/constants';
import { notify } from '@shared/notify';

export const handleApiError = (error, navigate, location) => {
  // Default error message
  let message = 'An unexpected error occurred';
  let redirectAction = null;
  let duration = 3000;

  // Handle different error types
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;

    switch (status) {
      case 400:
        message = data.message || 'Invalid request data';
        break;
      case 401:
        message = `${data.message || 'Session expired'} ${Constants.RE_LOGIN}`;
        if (navigate && location) {
          redirectAction = () => navigate(Constants.LOGIN_ROUTE, { state: { from: location } });
        }
        break;
      case 403:
        message = data.message || 'You are not authorized to perform this action';
        if (navigate && location) {
          redirectAction = () => navigate(Constants.DB_WORLD_HOME_ROUTE, { replace: true });
        }
        break;
      case 404:
        message = data.message || 'Resource not found';
        break;
      case 409:
        message = data.message || 'Conflict occurred';
        break;
      case 500:
        message = data.message || 'Internal server error';
        break;
      default:
        message = data.message || `Request failed with status ${status}`;
    }
  } else if (error.request) {
    // No response received
    message = 'No response from server. Please check your connection.';
  } else {
    // Request setup error
    message = error.message || 'Error setting up request';
  }

  // Show toast notification
  const toastConfig = { duration };
  if (redirectAction) {
    toastConfig.onClose = redirectAction;
  }

  console.error('API Error:', message);
  notify.error(message, toastConfig);

  // Return the error for further handling if needed
  return error;
};