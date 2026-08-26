import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { pathFromAppLink } from './appLinks';

/**
 * Routes Android App Link taps (a shared https://db-world.in/db-world/… URL)
 * into the SPA router.
 *
 * Two entry points, because they fire in different situations:
 *  - COLD start — the app wasn't running. The launch URL is already set before
 *    React mounts, so no listener would ever see it; `getLaunchUrl()` is the
 *    only way to recover it. Navigates with `replace` so Back doesn't return to
 *    a blank pre-navigation entry.
 *  - WARM — the app was already running. MainActivity is `launchMode="singleTask"`,
 *    so the intent arrives via onNewIntent and Capacitor emits `appUrlOpen`.
 *
 * No-ops off-native, where links are handled by the browser itself.
 */
export const useAppLinks = (navigate) => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let cancelled = false;
    let listener;

    (async () => {
      try {
        const launch = await CapacitorApp.getLaunchUrl();
        const path = pathFromAppLink(launch?.url);
        if (!cancelled && path) navigate(path, { replace: true });
      } catch { /* plugin unavailable — nothing to recover */ }

      try {
        const sub = await CapacitorApp.addListener('appUrlOpen', ({ url }) => {
          const path = pathFromAppLink(url);
          if (path) navigate(path);
        });
        // The effect may have been torn down while addListener was awaiting.
        if (cancelled) sub?.remove?.(); else listener = sub;
      } catch { /* not native */ }
    })();

    return () => {
      cancelled = true;
      listener?.remove?.();
    };
  }, [navigate]);
};

export default useAppLinks;
