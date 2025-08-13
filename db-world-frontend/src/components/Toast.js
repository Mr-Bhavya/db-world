import React from 'react';
import { 
  Snackbar,
  Alert,
  AlertTitle,
  Slide,
  Zoom,
  Fade,
  Grow,
  useTheme
} from '@mui/material';
import { 
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon 
} from '@mui/icons-material';

const isMobile = () => window.innerWidth <= 768;

const ToastContext = React.createContext();

export const ToastProvider = ({ children }) => {
  const theme = useTheme();
  const [toast, setToast] = React.useState({
    open: false,
    type: 'info',
    message: '',
    title: '',
    duration: 5000,
    position: 'bottom-right',
    onClose: null // Add onClose callback to state
  });

  const showToast = (type, message, options = {}) => {
    setToast({
      open: true,
      type,
      message,
      title: options.title || '',
      duration: options.duration || 5000,
      position: options.position || 'bottom-right',
      onClose: options.onClose || null // Store the callback
    });
  };

  // Create toast methods that can be accessed via context
  const toastMethods = {
    info: (message, options) => showToast('info', message, options),
    success: (message, options) => showToast('success', message, options),
    error: (message, options) => showToast('error', message, options),
    warning: (message, options) => showToast('warning', message, options),
  };

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    
    // Execute the callback before closing
    if (toast.onClose) {
      toast.onClose();
    }
    
    setToast(prev => ({ ...prev, open: false }));
  };

  const getTransition = (position) => {
    if (isMobile()) return Slide;
    
    const [vertical, horizontal] = position.split('-');
    switch (horizontal) {
      case 'left':
        return (props) => <Slide {...props} direction="right" />;
      case 'right':
        return (props) => <Slide {...props} direction="left" />;
      case 'center':
        return Grow;
      default:
        return Fade;
    }
  };

  const getAnchorOrigin = (position) => {
    const [vertical, horizontal] = position.split('-');
    return {
      vertical: vertical === 'top' ? 'top' : 'bottom',
      horizontal: horizontal === 'left' ? 'left' : horizontal === 'right' ? 'right' : 'center'
    };
  };

  const getAlertStyle = (type) => {
    const colors = {
      info: theme.palette.info.main,
      success: theme.palette.success.main,
      error: theme.palette.error.main,
      warning: theme.palette.warning.main,
    };
    
    return {
      backgroundColor: colors[type],
      color: theme.palette.getContrastText(colors[type]),
      boxShadow: theme.shadows[6],
      borderRadius: theme.shape.borderRadius,
      minWidth: isMobile() ? '90vw' : '350px',
      maxWidth: isMobile() ? '90vw' : '450px',
    };
  };

  const getAlertIcon = (type) => {
    const icons = {
      info: <InfoIcon fontSize="inherit" />,
      success: <CheckCircleIcon fontSize="inherit" />,
      error: <ErrorIcon fontSize="inherit" />,
      warning: <WarningIcon fontSize="inherit" />,
    };
    return icons[type];
  };

  return (
    <ToastContext.Provider value={toastMethods}>
      {children}
      <Snackbar
        open={toast.open}
        autoHideDuration={toast.duration}
        onClose={handleClose}
        TransitionComponent={getTransition(toast.position)}
        anchorOrigin={getAnchorOrigin(toast.position)}
        sx={{ 
          '& .MuiAlert-root': getAlertStyle(toast.type),
          '& .MuiAlert-icon': {
            color: theme.palette.getContrastText(getAlertStyle(toast.type).backgroundColor),
            fontSize: '1.5rem'
          }
        }}
      >
        <Alert
          icon={getAlertIcon(toast.type)}
          onClose={handleClose}
          severity={toast.type}
          variant="filled"
          elevation={6}
        >
          {toast.title && <AlertTitle>{toast.title}</AlertTitle>}
          {toast.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Create a separate export for direct toast access
export const toast = {
  info: null,
  success: null,
  error: null,
  warning: null,
};

// This component will initialize the toast methods after the context is available
export const ToastInitializer = () => {
  const { info, success, error, warning } = useToast();
  
  // Assign the methods to the toast object
  toast.info = info;
  toast.success = success;
  toast.error = error;
  toast.warning = warning;
  
  return null;
};