import React, { useEffect, useState } from 'react';
import { SnackbarProvider } from 'notistack';
import GlassSnackbar from './GlassSnackbar';
import { toastAnchor } from '@shared/platform/platform';

// Every variant renders through the one glass card.
const COMPONENTS = {
  success: GlassSnackbar,
  error: GlassSnackbar,
  warning: GlassSnackbar,
  info: GlassSnackbar,
  default: GlassSnackbar,
  loading: GlassSnackbar,
};

/**
 * App-wide toast host. Wraps notistack with the glass card and a device/screen-aware
 * anchor (top-center on phones, bottom-right on desktop) that re-evaluates on resize.
 * Replaces the previous SnackbarProvider + the legacy custom ToastProvider.
 */
export default function NotifyProvider({ children }) {
  const [anchorOrigin, setAnchorOrigin] = useState(toastAnchor);

  useEffect(() => {
    const onResize = () => {
      setAnchorOrigin((prev) => {
        const next = toastAnchor();
        return (prev.vertical === next.vertical && prev.horizontal === next.horizontal) ? prev : next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <SnackbarProvider
      maxSnack={4}
      autoHideDuration={3500}
      anchorOrigin={anchorOrigin}
      Components={COMPONENTS}
    >
      {children}
    </SnackbarProvider>
  );
}
