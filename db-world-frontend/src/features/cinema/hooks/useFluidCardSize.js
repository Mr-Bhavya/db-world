import { useSyncExternalStore } from 'react';

// ─── Shared viewport-width store ────────────────────────────────────────────
// One rAF-throttled resize subscription shared by every card/rail/popup, so
// fluid sizing re-renders happen together and only when the width actually
// changes (a stable innerWidth yields the same snapshot → no re-render).
const listeners = new Set();
let frame = 0;
const flush = () => { frame = 0; listeners.forEach((l) => l()); };
const onResize = () => { if (!frame) frame = requestAnimationFrame(flush); };

function subscribe(cb) {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('resize', onResize, { passive: true });
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('resize', onResize);
    }
  };
}

const getSnapshot = () => (typeof window !== 'undefined' ? window.innerWidth : 1440);
const getServerSnapshot = () => 1440;

// Continuous viewport width (px).
export function useViewportWidth() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const clamp = (min, v, max) => Math.max(min, Math.min(v, max));

// Fluid multiplier so cards/gaps/popup scale smoothly with the viewport instead
// of snapping at breakpoints. Pivots at 1440px = 1.0 (the tuned baseline), so a
// common desktop is unchanged; a small laptop shrinks toward 0.85, a large
// monitor grows toward 1.25.
export function desktopFluidFactor(vw) {
  return clamp(0.85, vw / 1440, 1.25);
}

// Gentler curve for the hover popup so it doesn't balloon on large monitors (it
// was reading as too large). Narrower range than the cards: 0.9×–1.12×.
export function popupFluidFactor(vw) {
  return clamp(0.9, vw / 1440, 1.12);
}

// Scale a display type's desktop base height for the current viewport — but ONLY
// on the desktop tier (mouse, ~900–1920px). Mobile/tablet keep their tuned sizes;
// TV keeps its fixed 10-foot layout.
export function fluidDesktopHeight(baseDesktop, tier, vw) {
  return tier === 'desktop' ? Math.round(baseDesktop * desktopFluidFactor(vw)) : baseDesktop;
}
