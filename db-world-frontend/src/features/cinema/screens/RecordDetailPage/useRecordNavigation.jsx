import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Opens a record's detail OVERLAY (the desktop modal / mobile sheet) the way
 * App.jsx expects — i.e. through React Router, carrying `background` in state.
 *
 * THE BUG THIS FIXES:
 *   The overlay in App.jsx only mounts when `location.state.background` is set
 *   AND React Router has actually processed the navigation (so useLocation
 *   re-renders ThemedApp). If the URL is changed any other way —
 *   window.history.pushState, window.location, a plain <a href>, or a navigate()
 *   that omits `background` — the URL bar updates but the router never re-renders,
 *   so nothing opens. On refresh the router boots from history state and the
 *   overlay appears, which is exactly the "only works after refresh" symptom.
 *
 *   Routing through here makes the overlay open on the click, every time.
 *
 * THE MORPH (popup → modal) COMES FREE:
 *   Pass the popup/card element as `anchorEl` and the modal springs out of its
 *   exact on-screen footprint (RecordDetailModal reads state.originRect), with
 *   the poster/title pre-painted from `cardRecord` so there's no grey flash.
 *   originRect is stored as a PLAIN object on purpose — a raw DOMRect does not
 *   survive a refresh through history state.
 *
 * @param {string} to        The detail URL you already build (the one that works
 *                            on refresh). Nothing about URL construction changes.
 * @param {object} [opts]
 * @param {Element} [opts.anchorEl]  Element to grow the modal out of (the hover
 *                                   popup, or the card). Omit → plain scale-in.
 * @param {object}  [opts.record]    Card data for the instant hero. Flat or
 *                                   tmdb-nested both work.
 */
export function useRecordNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const openRecord = useCallback((to, { anchorEl, record } = {}) => {
    const rect = anchorEl?.getBoundingClientRect?.(); // viewport-relative — what the modal's grow math assumes

    navigate(to, {
      state: {
        background: location, // ← the line that actually mounts the overlay
        ...(rect && {
          originRect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
        }),
        ...(record && {
          cardRecord: {
            title: record.title ?? record.name ?? record?.tmdb?.title ?? null,
            posterPath: record.posterPath ?? record?.tmdb?.posterPath ?? null,
            backdropPath: record.backdropPath ?? record?.tmdb?.backdropPath ?? null,
          },
        }),
      },
    });
  }, [navigate, location]);

  return { openRecord };
}