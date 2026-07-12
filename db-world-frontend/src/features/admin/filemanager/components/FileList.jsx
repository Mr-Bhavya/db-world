import { Box, Typography, Checkbox, IconButton, Tooltip, Skeleton } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { useFileManagerStore } from '../store/useFileManagerStore';
import ThumbnailImage from './ThumbnailImage';

/** Directories > this render as a truncation note instead of blowing up the DOM (no windowing lib in the project). */
const RENDER_LIMIT = 300;

const COL = { name: '38%', size: '12%', modified: '20%', type: '10%', actions: '20%' };

function HeaderCell({ label, sortKey, sortBy, sortOrder, onSort, width }) {
  const T = useT();
  const active = sortBy === sortKey;
  return (
    <Box
      onClick={() => onSort(sortKey)}
      sx={{
        width, fontSize: 11, fontWeight: 700, color: active ? T.teal : T.textFaint,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        cursor: 'pointer', userSelect: 'none',
        display: 'flex', alignItems: 'center', gap: 0.5,
        '&:hover': { color: T.teal },
      }}
    >
      {label}
      {active && <Typography sx={{ fontSize: 10 }}>{sortOrder === 'asc' ? '↑' : '↓'}</Typography>}
    </Box>
  );
}

function FileRow({ item, idx, selected, onOpen, onContextMenu, onDownload, onRename, onInfo, onDelete, visibleItems }) {
  const T = useT();
  const toggleSelect = useFileManagerStore((s) => s.toggleSelect);
  const navigate = useFileManagerStore((s) => s.navigate);

  const openItem = () => (item.directory ? navigate(item.path) : onOpen?.(item));

  const handleRowClick = (e) => {
    const additive = e.ctrlKey || e.metaKey;
    const range = e.shiftKey;
    toggleSelect(item.path, { additive, range, items: visibleItems });
    if (additive || range) return;
    openItem();
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    onContextMenu?.(e, item);
  };

  const actionBtn = (title, Icon, onClick, color = T.textFaint) => (
    <Tooltip title={title} key={title}>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); onClick(item); }}
        sx={{ color, '&:hover': { color: T.teal, bgcolor: T.hoverBg } }}
      >
        <Icon sx={{ fontSize: 15 }} />
      </IconButton>
    </Tooltip>
  );

  return (
    <motion.div
      key={item.path}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(idx * 0.012, 0.25), duration: 0.15 }}
    >
      <Box
        onClick={handleRowClick}
        onContextMenu={handleContextMenu}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 0.75,
          borderBottom: `1px solid ${T.border}`,
          bgcolor: selected ? T.tealBg : 'transparent',
          cursor: 'pointer',
          transition: 'background-color 0.1s',
          '&:hover': { bgcolor: selected ? T.tealBgHover : T.hoverBg },
          '&:hover .fm-row-actions': { opacity: 1 },
        }}
      >
        <Checkbox
          size="small"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleSelect(item.path, { additive: true, items: visibleItems })}
          sx={{ p: 0.25, color: T.textFaint, '&.Mui-checked': { color: T.teal } }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: COL.name, overflow: 'hidden' }}>
          <ThumbnailImage item={item} size={22} borderRadius={1} />
          <Typography sx={{
            fontSize: 13, color: T.textPrimary, fontWeight: item.directory ? 600 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.name}
          </Typography>
        </Box>

        <Typography sx={{ width: COL.size, fontSize: 12, color: T.textMuted }}>
          {item.directory ? `${item.childCount} items` : item.formattedSize}
        </Typography>
        <Typography sx={{ width: COL.modified, fontSize: 12, color: T.textMuted }}>
          {item.lastModified ? format(new Date(item.lastModified), 'MMM d, yyyy HH:mm') : '—'}
        </Typography>
        <Typography sx={{ width: COL.type, fontSize: 12, color: T.textMuted, textTransform: 'uppercase' }}>
          {item.directory ? 'Folder' : (item.extension || '—')}
        </Typography>

        <Box
          className="fm-row-actions"
          sx={{
            width: COL.actions, display: 'flex', gap: 0.25, justifyContent: 'flex-end',
            opacity: 0, transition: 'opacity 0.12s',
          }}
        >
          {actionBtn('Open', OpenInNewIcon, () => openItem())}
          {!item.directory && actionBtn('Download', DownloadIcon, () => onDownload?.(item))}
          {actionBtn('Rename', EditIcon, () => onRename?.(item))}
          {actionBtn('Info', InfoOutlinedIcon, () => onInfo?.(item))}
          {actionBtn('Delete', DeleteIcon, () => onDelete?.(item), T.error)}
        </Box>
      </Box>
    </motion.div>
  );
}

/**
 * Desktop table view. Sortable header cells cycle `setSortBy`/`setSortOrder`;
 * row selection follows the same click/ctrl/shift semantics as `FileGrid`.
 * Hover-only action icons cover open/download/rename/info/delete directly;
 * right-click still reports `onContextMenu(event, item)` for the full action
 * set (move/copy/cut/etc.), same contract as the grid and mobile views.
 */
export default function FileList({
  items = [], isLoading = false, onOpen, onContextMenu, onDownload, onRename, onInfo, onDelete,
}) {
  const T = useT();
  const selection = useFileManagerStore((s) => s.selection);
  const selectAll = useFileManagerStore((s) => s.selectAll);
  const clearSelection = useFileManagerStore((s) => s.clearSelection);
  const sortBy = useFileManagerStore((s) => s.sortBy);
  const setSortBy = useFileManagerStore((s) => s.setSortBy);
  const sortOrder = useFileManagerStore((s) => s.sortOrder);
  const setSortOrder = useFileManagerStore((s) => s.setSortOrder);

  const handleSort = (key) => {
    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortOrder('asc'); }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={36} sx={{ bgcolor: T.glassHover }} />
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
  const allSelected = visibleItems.length > 0 && visibleItems.every((i) => selection.has(i.path));

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 2, py: 0.75, borderBottom: `1px solid ${T.border}`,
        position: 'sticky', top: 0, bgcolor: T.adminBg, zIndex: 1,
      }}>
        <Checkbox
          size="small" checked={allSelected}
          onChange={() => (allSelected ? clearSelection() : selectAll(visibleItems))}
          sx={{ p: 0.25, color: T.textFaint, '&.Mui-checked': { color: T.teal } }}
        />
        <HeaderCell label="Name"     sortKey="name"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.name} />
        <HeaderCell label="Size"     sortKey="size"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.size} />
        <HeaderCell label="Modified" sortKey="modified" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.modified} />
        <HeaderCell label="Type"     sortKey="type"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.type} />
        <Box sx={{ width: COL.actions }} />
      </Box>

      <AnimatePresence>
        {visibleItems.map((item, idx) => (
          <FileRow
            key={item.path}
            item={item}
            idx={idx}
            selected={selection.has(item.path)}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
            onDownload={onDownload}
            onRename={onRename}
            onInfo={onInfo}
            onDelete={onDelete}
            visibleItems={visibleItems}
          />
        ))}
      </AnimatePresence>

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
