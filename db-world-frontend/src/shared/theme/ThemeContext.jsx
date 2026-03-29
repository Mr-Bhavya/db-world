import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { getTokens } from './index';

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

/** Global app theme — defaults to dark, stored under dbworld-theme */
export const ThemeTokensProvider = makeProvider('dbworld-theme', 'dark');

/** Admin-section theme — defaults to light, stored under dbworld-admin-theme (independent of home) */
export const AdminThemeProvider = makeProvider('dbworld-admin-theme', 'light');

export const useThemeMode = () => {
  const ctx = useContext(ThemeTokensContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeTokensProvider');
  return ctx;
};

/** Convenience hook — just returns the current token set */
export const useT = () => useThemeMode().T;
