import { toast } from '@shared/components/ui/Toast';

export const handleApiSuccess = (message, navigate, redirectPath = null, autoClose = 1000) => {
  const toastConfig = { autoClose };
  
  if (redirectPath) {
    toastConfig.onClose = () => navigate(redirectPath);
  }

  toast.success(message, toastConfig);
};
