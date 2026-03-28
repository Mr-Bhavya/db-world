// hooks/useFlmngrTheme.js
import { useMemo } from 'react';
import { useTheme } from '@mui/material';

export const useFlmngrTheme = () => {
  const theme = useTheme();
  
  return useMemo(() => {
    return {
      primary: theme.palette.primary.main,
      secondary: theme.palette.secondary.main,
      background: theme.palette.background.paper,
      text: theme.palette.text.primary,
      border: theme.palette.divider,
      borderRadius: theme.shape.borderRadius,
      spacing: theme.spacing(1),
      shadows: theme.shadows,
    };
  }, [theme]);
};