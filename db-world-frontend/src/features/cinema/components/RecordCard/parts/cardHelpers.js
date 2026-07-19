// Shared helpers/state for RecordCard and its sub-components.

export const POPUP_W = 470; // hover popup base width (desktop); scaled per-viewport

export const year = (d) => (d ? String(d).slice(0, 4) : '');

export const fmtRuntime = (mins) => {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
};

// After navigating from a popup, suppress new hover popups for 600ms so the next
// card's popup doesn't appear while the modal is loading. Shared mutable holder so
// HoverPopup (writer) and RecordCard (reader) coordinate across modules.
export const navBlock = { until: 0 };

// Only one hover popup may be open at a time. Each popup registers its immediate
// close here on open and clears it on unmount, so opening a new one dismisses a
// previous popup that may still be glued to a card after a scroll.
export const activeHoverPopup = { close: null };
