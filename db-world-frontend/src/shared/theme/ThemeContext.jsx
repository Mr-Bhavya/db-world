import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { getTokens } from './index';
import { DB_ADMIN_BASE_ROUTE } from '@shared/constants';

const ThemeTokensContext = createContext(null);

function makeProvider(storageKey, defaultMode) {
  return function ThemeProvider({ children }) {
    const [mode, setMode] = useState(() => localStorage.getItem(storageKey) || defaultMode);

    const toggleMode = useCallback(() => {
      setMode(prev => {
        const next = prev === 'dark' ? 'light' : 'dark';
        localStorage.setItem(storageKey, next);
        return next;
      });
    }, []);

    const T = useMemo(() => getTokens(mode), [mode]);
    const value = useMemo(() => ({ mode, toggleMode, T }), [mode, toggleMode, T]);

    return (
      <ThemeTokensContext.Provider value={value}>
        {children}
      </ThemeTokensContext.Provider>
    );
  };
}

/** localStorage keys + defaults for the two independent theme scopes. */
export const GLOBAL_THEME_KEY = 'dbworld-theme';
export const ADMIN_THEME_KEY = 'dbworld-admin-theme';
export const GLOBAL_THEME_DEFAULT = 'dark';
export const ADMIN_THEME_DEFAULT = 'light';

/** Global app theme — defaults to dark, stored under dbworld-theme */
export const ThemeTokensProvider = makeProvider(GLOBAL_THEME_KEY, GLOBAL_THEME_DEFAULT);

/** Admin-section theme — defaults to light, stored under dbworld-admin-theme (independent of home) */
export const AdminThemeProvider = makeProvider(ADMIN_THEME_KEY, ADMIN_THEME_DEFAULT);

const readMode = (key, def) => {
  try { return localStorage.getItem(key) || def; } catch { return def; }
};

/**
 * Mode ('light' | 'dark') of the currently-visible surface. The admin section runs its own theme
 * scope (AdminThemeProvider), so a globally-mounted overlay like the toast host can't rely on
 * useT() (which would always read the root/global scope). Resolve the right scope from the route.
 */
export function getActiveThemeMode() {
  const p = (typeof window !== 'undefined' && window.location?.pathname) || '';
  const inAdmin = p === DB_ADMIN_BASE_ROUTE || p.startsWith(`${DB_ADMIN_BASE_ROUTE}/`);
  return inAdmin ? readMode(ADMIN_THEME_KEY, ADMIN_THEME_DEFAULT) : readMode(GLOBAL_THEME_KEY, GLOBAL_THEME_DEFAULT);
}

export const useThemeMode = () => {
  const ctx = useContext(ThemeTokensContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeTokensProvider');
  return ctx;
};

/** Convenience hook — just returns the current token set */
export const useT = () => useThemeMode().T;
