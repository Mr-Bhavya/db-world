/**
 * Stale-chunk recovery after a frontend deploy.
 *
 * The web app (and the Android Capacitor WebView, which loads the live site)
 * code-splits routes via `lazy(() => import(...))`. Vite emits content-hashed
 * chunks like `/assets/AdminDashboard-AbC123.js`. When a new build is deployed,
 * nginx serves only the new hashes from `current` and the old ones start
 * returning 404. A page that was already loaded before the deploy still
 * references the old hashes, so the next lazy `import()` fails — the user lands
 * on a broken/404 screen until they manually refresh.
 *
 * Re-fetching index.html (a full reload) picks up the new hashes and recovers,
 * so we do that automatically the first time we detect such a failure. This is
 * most visible on Android because the WebView keeps a loaded page alive across
 * long background periods, so users routinely run a build that's hours old.
 *
 * A short time-window guard prevents reload loops: if we just reloaded and the
 * page still can't load its chunks, we stop and let the error surface instead
 * of looping forever.
 */

const RELOAD_GUARD_KEY = 'dbworld:chunk-reload-at';
const RELOAD_GUARD_WINDOW_MS = 10_000;

/** Heuristic: does this error look like a failed dynamic-import / chunk load? */
export function isChunkLoadError(error) {
  if (!error) return false;
  const name = error.name || '';
  const msg = String(error.message || error);
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) // Safari / iOS WebView wording
  );
}

/**
 * Reload the page once to pick up the freshly-deployed chunks.
 *
 * @returns {boolean} true if a reload was triggered, false if suppressed by the
 *   loop guard (meaning the caller should surface the error instead).
 */
export function reloadForStaleChunks() {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY)) || 0;
  } catch {
    // sessionStorage may be unavailable (private mode / locked-down WebView).
  }

  if (Date.now() - last < RELOAD_GUARD_WINDOW_MS) {
    // We reloaded moments ago and still failed — stop to avoid an infinite loop.
    return false;
  }

  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // ignore — worst case we lose the loop guard
  }

  window.location.reload();
  return true;
}

/**
 * Register Vite's preload-error handler. Vite dispatches a cancelable
 * `vite:preloadError` event on window when a dynamically imported chunk fails
 * to load — exactly the stale-deploy case. We recover by reloading once. When
 * the loop guard suppresses the reload, we let Vite re-throw so the React
 * ErrorBoundary can show its recovery UI instead of hanging on a spinner.
 */
export function installChunkReloadHandler() {
  window.addEventListener('vite:preloadError', (event) => {
    const reloaded = reloadForStaleChunks();
    if (reloaded) {
      // We're navigating away; suppress Vite's default re-throw.
      event.preventDefault?.();
    }
  });
}
