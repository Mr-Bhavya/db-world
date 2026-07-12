import { useRef } from 'react';
import { Box, Typography, IconButton, Divider, Skeleton } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { format } from 'date-fns';
import { useT } from '@shared/theme';
import { useFileManagerStore } from '../store/useFileManagerStore';
import ThumbnailImage from './ThumbnailImage';

/** Directories > this render as a truncation note instead of blowing up the DOM (no windowing lib in the project). */
const RENDER_LIMIT = 300;
const LONG_PRESS_MS = 500;

function MobileRow({ item, selected, onOpen, onContextMenu, visibleItems }) {
  const T = useT();
  const toggleSelect = useFileManagerStore((s) => s.toggleSelect);
  const navigate = useFileManagerStore((s) => s.navigate);
  const pressTimer = useRef(null);
  const longPressed = useRef(false);

  const clearTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handlePointerDown = () => {
    longPressed.current = false;
    clearTimer();
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      toggleSelect(item.path, { additive: true, items: visibleItems });
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    clearTimer();
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (item.directory) navigate(item.path);
    else onOpen?.(item);
  };

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1.25,
        bgcolor: selected ? T.tealBg : 'transparent',
        '&:active': { bgcolor: selected ? T.tealBgHover : T.hoverBg },
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, item); }}
    >
      {selected ? (
        <Box sx={{
          width: 38, height: 38, borderRadius: 1.5, flexShrink: 0,
          bgcolor: T.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircleIcon sx={{ fontSize: 22, color: T.teal }} />
        </Box>
      ) : (
        <ThumbnailImage item={item} size={38} borderRadius={1.5} />
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: 14, fontWeight: item.directory ? 600 : 400, color: T.textPrimary,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.name}
        </Typography>
        <Typography sx={{ fontSize: 11, color: T.textFaint }}>
          {item.directory ? `${item.childCount} items` : item.formattedSize}
          {item.lastModified && ` · ${format(new Date(item.lastModified), 'MMM d, yyyy')}`}
        </Typography>
      </Box>

      {item.directory && !selected && <ChevronRightIcon sx={{ fontSize: 16, color: T.textFaint }} />}

      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); onContextMenu?.(e, item); }}
        sx={{ color: T.textFaint }}
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

  const visibleItems = items.slice(0, RENDER_LIMIT);
  const truncated = items.length > RENDER_LIMIT;

  return (
    <Box>
      {visibleItems.map((item, idx) => (
        <Box key={item.path}>
          <MobileRow
            item={item}
            selected={selection.has(item.path)}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
            visibleItems={visibleItems}
          />
          {idx < visibleItems.length - 1 && <Divider sx={{ borderColor: T.border, mx: 2 }} />}
        </Box>
      ))}

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
