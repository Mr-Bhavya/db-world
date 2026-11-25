import { useEffect, useRef } from 'react';
import { Box, Typography, IconButton, Checkbox, Divider, Skeleton } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { useFileManagerStore } from '../store/useFileManagerStore';
import ThumbnailImage from './ThumbnailImage';

const LONG_PRESS_MS = 500;

function MobileRow({ item, selected, selectionActive, onOpen, onContextMenu, visibleItems }) {
  const T = useT();
  const toggleSelect = useFileManagerStore((s) => s.toggleSelect);
  const navigate = useFileManagerStore((s) => s.navigate);
  const pressTimer = useRef(null);
  const longPressed = useRef(false);
  const pointerStart = useRef(null);

  const clearTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // Guard against the pending long-press timer firing (toggling selection)
  // after the row has already unmounted, e.g. navigating away mid-press.
  useEffect(() => () => clearTimer(), []);

  const handlePointerDown = (event) => {
    longPressed.current = false;
    pointerStart.current = { x: event.clientX, y: event.clientY, moved: false };
    clearTimer();
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      toggleSelect(item.path, { additive: true, items: visibleItems });
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event) => {
    const start = pointerStart.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
      start.moved = true;
      clearTimer();
    }
  };

  const handleActivate = () => {
    clearTimer();
    if (longPressed.current || pointerStart.current?.moved) {
      longPressed.current = false;
      pointerStart.current = null;
      return;
    }
    pointerStart.current = null;
    if (selectionActive) {
      toggleSelect(item.path, { additive: true, items: visibleItems });
      return;
    }
    if (item.directory) navigate(item.path);
    else onOpen?.(item);
  };

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        px: 1, py: 0.75,
        bgcolor: selected ? T.tealBg : 'transparent',
        '&:active': { bgcolor: selected ? T.tealBgHover : T.hoverBg },
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearTimer}
      onPointerLeave={() => { clearTimer(); if (pointerStart.current) pointerStart.current.moved = true; }}
      onPointerCancel={() => { clearTimer(); pointerStart.current = null; }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, item); }}
    >
      <Checkbox
        checked={selected}
        inputProps={{ 'aria-label': `Select ${item.name}` }}
        onChange={() => toggleSelect(item.path, { additive: true, items: visibleItems })}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        sx={{ width: 44, height: 44, color: T.textFaint, '&.Mui-checked': { color: T.teal } }}
      />
      <Box
        component="button"
        type="button"
        onClick={handleActivate}
        sx={{
          flex: 1, minWidth: 0, minHeight: 44, display: 'flex', alignItems: 'center', gap: 1.5,
          p: 0, border: 0, bgcolor: 'transparent', textAlign: 'left', cursor: 'pointer',
        }}
      >
        <ThumbnailImage item={item} size={38} borderRadius={1.5} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontSize: 14, fontWeight: item.directory ? 600 : 400, color: T.textPrimary,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.name}
          </Typography>
          <Typography sx={{ fontSize: 11, color: T.textFaint }}>
            {item.directory
              ? (item.childCount > 0 ? `${item.childCount} items` : 'Folder')
              : item.formattedSize}
            {item.lastModified && ` · ${format(new Date(item.lastModified), 'MMM d, yyyy')}`}
          </Typography>
        </Box>
        {item.directory && !selected && <ChevronRightIcon sx={{ fontSize: 16, color: T.textFaint }} />}
      </Box>

      <IconButton
        size="small"
        aria-label={`More actions for ${item.name}`}
        onClick={(e) => { e.stopPropagation(); onContextMenu?.(e, item); }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerLeave={(e) => e.stopPropagation()}
        sx={{ color: T.textFaint, width: 44, height: 44 }}
      >
        <MoreVertIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
}

/**
 * Compact touch list. Tap opens a file (`onOpen(item)`) or navigates into a
 * folder; a long-press (500ms) toggles the item into the selection
 * additively without opening it — the usual "enter select mode" gesture.
 * The trailing MoreVert (or a right-click/long-press-free-form context menu)
 * reports `onContextMenu(event, item)`, same contract as the grid/list views.
 */
export default function FileMobileList({ items = [], isLoading = false, onOpen, onContextMenu }) {
  const T = useT();
  const selection = useFileManagerStore((s) => s.selection);
  const visibleItems = items;

  if (isLoading) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={54} sx={{ bgcolor: T.glassHover }} />
        ))}
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 14, color: T.textMuted }}>No files found</Typography>
      </Box>
    );
  }

  const selectionActive = selection.size > 0;

  return (
    <Box>
      <AnimatePresence>
        {visibleItems.map((item, idx) => (
          <motion.div
            key={item.path}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: Math.min(idx * 0.012, 0.25), duration: 0.15 }}
          >
            <MobileRow
              item={item}
              selected={selection.has(item.path)}
              selectionActive={selectionActive}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
              visibleItems={visibleItems}
            />
            {idx < visibleItems.length - 1 && <Divider sx={{ borderColor: T.border, mx: 2 }} />}
          </motion.div>
        ))}
      </AnimatePresence>

    </Box>
  );
}
