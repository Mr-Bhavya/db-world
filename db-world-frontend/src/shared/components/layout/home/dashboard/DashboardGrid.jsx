import React, { useCallback, useRef } from 'react';
import { Box } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Grid footprint per widget size. Four columns on desktop, two on phones and tablets, so `md`
 * (half the desktop row) becomes full width on a phone and `lg` keeps its extra height.
 *
 * Rows are a fixed height rather than `1fr` because widgets carry different amounts of content;
 * a fixed track is what makes a `lg` tile reliably twice the height of an `sm` one instead of
 * whatever its text happens to need.
 */
export const SIZE_SPANS = {
  sm: { columns: { xs: 'span 1', md: 'span 1' }, rows: 'span 1' },
  md: { columns: { xs: 'span 2', md: 'span 2' }, rows: 'span 1' },
  lg: { columns: { xs: 'span 2', md: 'span 2' }, rows: 'span 2' },
};

/** How close two reorders may be, in ms. Without it, one drag oscillates between two slots. */
const REORDER_COOLDOWN_MS = 120;

/**
 * The dashboard's sortable bento grid.
 *
 * Reordering is only possible in edit mode, which also removes the tiles' own click targets — so
 * the usual "was that a drag or a tap?" ambiguity never arises and no click guard is needed.
 *
 * Drag is framer's, with `dragSnapToOrigin`: the tile follows the pointer, the live reorder moves
 * everything else out of the way via `layout`, and on release the tile settles into whatever slot
 * it now occupies. Hit-testing is nearest-centre against the other tiles' client rects, which
 * handles the mixed footprints (a `lg` tile next to two `sm` ones) that index arithmetic cannot.
 */
export default function DashboardGrid({ items, editing, onMove, renderItem }) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef(null);
  const itemRefs = useRef(new Map());
  const lastMoveAt = useRef(0);

  const setItemRef = useCallback((id) => (node) => {
    if (node) itemRefs.current.set(id, node);
    else itemRefs.current.delete(id);
  }, []);

  const handleDrag = useCallback(
    (fromIndex) => (_event, info) => {
      const now = Date.now();
      if (now - lastMoveAt.current < REORDER_COOLDOWN_MS) return;

      let nearest = fromIndex;
      let nearestDistance = Infinity;

      items.forEach((item, index) => {
        const node = itemRefs.current.get(item.id);
        if (!node) return;

        const rect = node.getBoundingClientRect();
        // `info.point` is in document coordinates; client rects are viewport-relative.
        const centreX = rect.left + rect.width / 2 + window.scrollX;
        const centreY = rect.top + rect.height / 2 + window.scrollY;
        const distance = (centreX - info.point.x) ** 2 + (centreY - info.point.y) ** 2;

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = index;
        }
      });

      if (nearest !== fromIndex) {
        lastMoveAt.current = now;
        onMove(fromIndex, nearest);
      }
    },
    [items, onMove]
  );

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
        },
        gridAutoRows: {
          xs: 128,
          sm: 150,
          md: 164,
          xl: 186,
        },
        // Dense packing backfills the gap a wide tile leaves when it cannot fit in the columns
        // remaining on a row. Users resize freely, so no default ordering can avoid those gaps —
        // and a hole in the grid reads as a bug rather than as a choice. Reordering is unaffected:
        // the drag hit-test measures real client rects, not grid indices.
        gridAutoFlow: 'dense',
        gap: { xs: 1.1, sm: 1.6, md: 2, xl: 2.4 },
        minWidth: 0,
      }}
    >
      {items.map((widget, index) => {
        const span = SIZE_SPANS[widget.size] ?? SIZE_SPANS.sm;

        return (
          <Box
            key={widget.id}
            ref={setItemRef(widget.id)}
            component={motion.div}
            layout={!prefersReducedMotion}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag={editing}
            dragSnapToOrigin
            dragElastic={0.16}
            dragMomentum={false}
            dragConstraints={containerRef}
            onDrag={handleDrag(index)}
            whileDrag={{
              scale: 1.04,
              zIndex: 20,
              boxShadow: '0 30px 70px rgba(0,0,0,0.38)',
              cursor: 'grabbing',
            }}
            sx={{
              gridColumn: span.columns,
              gridRow: span.rows,
              display: 'flex',
              minWidth: 0,
              position: 'relative',
              touchAction: editing ? 'none' : 'auto',
            }}
          >
            {renderItem(widget, index)}
          </Box>
        );
      })}
    </Box>
  );
}
