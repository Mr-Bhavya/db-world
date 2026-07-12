import { useState } from 'react';
import { Box, Typography, IconButton, Checkbox, Skeleton } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { useFileManagerStore } from '../store/useFileManagerStore';
import ThumbnailImage from './ThumbnailImage';
import { setDragItems, clearDragItems } from './dndPayload';

/** Directories > this render as a truncation note instead of blowing up the DOM (no windowing lib in the project). */
const RENDER_LIMIT = 300;

function FileCard({ item, selected, onOpen, onContextMenu, onMoveTo, visibleItems, touchSelect, selectionActive }) {
  const T = useT();
  const toggleSelect = useFileManagerStore((s) => s.toggleSelect);
  const navigate = useFileManagerStore((s) => s.navigate);
  const selection = useFileManagerStore((s) => s.selection);
  const [dropHover, setDropHover] = useState(false);

  const handleClick = (e) => {
    const additive = e.ctrlKey || e.metaKey;
    const range = e.shiftKey;
    if (additive || range) {
      toggleSelect(item.path, { additive, range, items: visibleItems });
      return;
    }
    if (touchSelect && selectionActive) {
      toggleSelect(item.path, { additive: true, items: visibleItems });
      return;
    }
    toggleSelect(item.path, { items: visibleItems });
    if (item.directory) navigate(item.path);
    else onOpen?.(item);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    onContextMenu?.(e, item);
  };

  const handleMore = (e) => {
    e.stopPropagation();
    onContextMenu?.(e, item);
  };

  const handleDragStart = (e) => {
    const dragged = selected ? visibleItems.filter((i) => selection.has(i.path)) : [item];
    setDragItems(dragged);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', item.name); } catch { /* noop */ }
  };

  const handleDragEnd = () => clearDragItems();

  const folderDropProps = item.directory ? {
    onDragOver: (e) => { e.preventDefault(); setDropHover(true); },
    onDragLeave: () => setDropHover(false),
    onDrop: (e) => { e.preventDefault(); setDropHover(false); onMoveTo?.(item.path); },
  } : {};

  return (
    <Box
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      {...folderDropProps}
      sx={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 0.75,
        p: 1.25, borderRadius: 2,
        border: `1px solid ${dropHover || selected ? T.teal : T.border}`,
        bgcolor: dropHover ? T.tealBgHover : selected ? T.tealBg : T.glass,
        outline: dropHover ? `1px dashed ${T.teal}` : 'none',
        outlineOffset: -3,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s',
        '&:hover': { borderColor: T.teal, bgcolor: selected ? T.tealBgHover : T.glassHover },
        minWidth: 0, overflow: 'hidden',
      }}
    >
      <Checkbox
        size="small"
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={() => toggleSelect(item.path, { additive: true, items: visibleItems })}
        sx={{
          position: 'absolute', top: 4, left: 4, p: 0.25, zIndex: 1,
          color: T.textFaint, '&.Mui-checked': { color: T.teal },
        }}
      />
      <IconButton
        size="small"
        onClick={handleMore}
        sx={{
          position: 'absolute', top: 4, right: 4, zIndex: 1,
          color: T.textFaint, '&:hover': { color: T.teal, bgcolor: T.hoverBg },
        }}
      >
        <MoreVertIcon sx={{ fontSize: 16 }} />
      </IconButton>

      <Box sx={{ width: '100%', height: 72, borderRadius: 1.5, overflow: 'hidden' }}>
        <ThumbnailImage item={item} fill />
      </Box>

      <Typography sx={{
        fontSize: 12.5, fontWeight: item.directory ? 600 : 400, color: T.textPrimary,
        textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {item.name}
      </Typography>
      <Typography sx={{ fontSize: 10.5, color: T.textFaint, textAlign: 'center' }}>
        {item.directory
          ? (item.childCount > 0 ? `${item.childCount} item${item.childCount === 1 ? '' : 's'}` : 'Folder')
          : item.formattedSize}
      </Typography>
    </Box>
  );
}

/**
 * Card-grid browser view. Selection semantics: plain click selects the item
 * (replacing the selection) and performs the primary action — navigate for a
 * folder, `onOpen(item)` for a file; ctrl/cmd-click toggles the item into the
 * selection additively; shift-click selects the inclusive range from the last
 * anchor. The checkbox overlay always toggles additively. Right-click or the
 * card's MoreVert button both report `onContextMenu(event, item)` — the page
 * owns the single `ContextMenu` instance and builds `{mouseX, mouseY, item}`
 * from the event's `clientX`/`clientY`.
 */
export default function FileGrid({ items = [], isLoading = false, onOpen, onContextMenu, onMoveTo, touchSelect = false }) {
  const T = useT();
  const selection = useFileManagerStore((s) => s.selection);

  if (isLoading) {
    return (
      <Box sx={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 1.5, p: 2,
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" sx={{ height: 132, bgcolor: T.glassHover, borderRadius: 2 }} />
        ))}
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 14, color: T.textMuted }}>No files found</Typography>
      </Box>
    );
  }

  const visibleItems = items.slice(0, RENDER_LIMIT);
  const truncated = items.length > RENDER_LIMIT;
  const selectionActive = selection.size > 0;

  return (
    <Box>
      <Box sx={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 1.5, p: 2,
      }}>
        <AnimatePresence>
          {visibleItems.map((item, idx) => (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ delay: Math.min(idx * 0.015, 0.3), duration: 0.15 }}
            >
              <FileCard
                item={item}
                selected={selection.has(item.path)}
                onOpen={onOpen}
                onContextMenu={onContextMenu}
                onMoveTo={onMoveTo}
                visibleItems={visibleItems}
                touchSelect={touchSelect}
                selectionActive={selectionActive}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </Box>
      {truncated && (
        <Box sx={{ px: 2, py: 1.5, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: T.textFaint }}>
            Showing first {RENDER_LIMIT} of {items.length} — refine with search
          </Typography>
        </Box>
      )}
    </Box>
  );
}
