import { useRef } from 'react';

/**
 * If the gesture started inside a horizontally-scrollable element (a wide table,
 * a DataGrid virtual scroller, a scrollable chip/tab row), that horizontal drag
 * is a SCROLL — not a tab change. Walk up a few ancestors and bail if we find one.
 */
const startsInHorizontalScroller = (el) => {
  let node = el;
  let hops = 0;
  while (node && node !== document.body && hops < 12) {
    if (node.scrollWidth > node.clientWidth + 4) {
      const ox = getComputedStyle(node).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    node = node.parentElement;
    hops += 1;
  }
  return false;
};

/**
 * Lightweight horizontal-swipe gesture for tab navigation on touch devices.
 * Spread the returned handlers onto the tab-CONTENT container:
 *
 *   const swipe = useSwipeNav({ onPrev: prevTab, onNext: nextTab });
 *   <Box {...swipe}>{activePanel}</Box>
 *
 * Fires only on a clearly-horizontal swipe past `threshold` px that did NOT
 * start inside a horizontal scroller — so vertical scrolling and horizontal
 * table/grid scrolling are never hijacked.
 */
export const useSwipeNav = ({ onPrev, onNext, threshold = 60 } = {}) => {
  const start = useRef(null);

  return {
    onTouchStart: (e) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, target: e.target };
    },
    onTouchEnd: (e) => {
      if (!start.current) return;
      const s = start.current;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      start.current = null;

      if (startsInHorizontalScroller(s.target)) return;
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.6) {
        if (dx < 0) onNext?.();
        else onPrev?.();
      }
    },
  };
};
