import CircularProgress from '@mui/material/CircularProgress';

export const iconButtonStyles = {
  inactiveColor: 'rgba(255, 255, 255, 0.2)',
  activeColor: 'white',
  hoverColor: 'rgba(255, 255, 255, 0.1)',
  iconSize: '1.5rem',
};

export const spinnerIcon = (
  <CircularProgress size={22} thickness={5} sx={{ color: iconButtonStyles.activeColor }} />
);
