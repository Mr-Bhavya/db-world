import Constants from "../Constants";

export const handleApiSuccess = (message, navigate, redirectPath = null, autoClose = 1000) => {
  const toastConfig = { autoClose };
  
  if (redirectPath) {
    toastConfig.onClose = () => navigate(redirectPath);
  }

  Constants.showToast.success(message, toastConfig);
};
