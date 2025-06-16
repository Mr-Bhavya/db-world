import { toast, Slide, Flip, Zoom, Bounce } from 'react-toastify';
import { MdInfo, MdCheckCircle, MdError, MdWarning } from 'react-icons/md';


const isMobile = () => window.innerWidth <= 768;

const baseStyle = {
  color: '#fff',
  padding: '12px 16px',
  borderRadius: '8px',
  fontSize: '0.95rem',
};

const getTransition = (type) => {
  if (isMobile()) return Slide;

  switch (type) {
    case 'success':
      return Flip;
    case 'error':
      return Zoom;
    case 'warning':
      return Bounce;
    case 'info':
    default:
      return Flip;
  }
};

const createToast = (type, icon, bgColor) => (message, options = {}) => {
  const defaultOptions = {
    icon,
    style: {
      ...baseStyle,
      background: bgColor,
      boxShadow: `0 4px 12px rgba(0, 0, 0, 0.2)`,
    },
    transition: getTransition(type),
    autoClose: 5000,
    ...options,
  };

  return toast[type](message, defaultOptions);
};

export const showToast = {
  info: createToast('info', MdInfo, '#3182ce'),
  success: createToast('success', MdCheckCircle, '#38a169'),
  error: createToast('error', MdError, '#e53e3e'),
  warning: createToast('warning', MdWarning, '#dd6b20'),
};
