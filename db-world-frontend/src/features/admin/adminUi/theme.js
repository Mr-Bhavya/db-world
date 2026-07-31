/**
 * Admin UI kit — theming helpers.
 *
 * `useAdminMuiTheme()`  — the admin MUI theme (light/dark), extracted so the four
 *                         duplicated createTheme() copies can converge onto one.
 * `adminSurface(T)`     — CLEAN & FLAT surface tokens: solid opaque cards + 1px
 *                         borders. No glass, no blur, no gradients (per the admin
 *                         design direction). Single teal accent; status colours
 *                         only where they carry meaning.
 */
import { useMemo } from 'react';
import { createTheme } from '@mui/material/styles';
import { useThemeMode } from '@shared/theme';

export const useAdminMuiTheme = () => {
  const { mode } = useThemeMode();
  return useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#0d9488' },
      ...(mode === 'light' ? {
        background: { default: '#f6f7f9', paper: '#ffffff' },
        text: { primary: '#0f172a', secondary: 'rgba(15,23,42,0.60)' },
      } : {
        // Opaque values — rgba glass tokens make Drawer/Select/Autocomplete popups
        // look transparent.
        background: { default: '#0a0a0b', paper: '#141517' },
        text: { primary: '#ffffff', secondary: 'rgba(255,255,255,0.60)' },
      }),
    },
    shape: { borderRadius: 10 },
  }), [mode]);
};

/** Solid, flat surface palette derived from the current token set. */
export const adminSurface = (T) => {
  const dark = T.bg === '#000000';
  return {
    page:      dark ? '#0a0a0b' : '#f6f7f9',
    card:      dark ? '#141517' : '#ffffff',
    cardHover: dark ? '#1a1b1e' : '#f8fafc',
    inset:     dark ? '#0e0f11' : '#f1f5f9',
    border:    dark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.10)',
    divider:   dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)',
  };
};
