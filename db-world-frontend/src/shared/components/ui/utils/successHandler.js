import { notify } from '@shared/notify';

export const handleApiSuccess = (message, navigate, redirectPath = null, duration = 1000) => {
  const toastConfig = { duration };
  
  if (redirectPath) {
    toastConfig.onClose = () => navigate(redirectPath);
  }

  notify.success(message, toastConfig);
};
