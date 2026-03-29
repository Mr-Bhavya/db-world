import { Box, Typography, Checkbox, IconButton, Tooltip } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DownloadIcon from '@mui/icons-material/Download';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { getFileColor } from './fileIcons';
import { downloadFile } from './fileManagerApi';

const COL = { name: '40%', size: '12%', type: '12%', modified: '18%', actions: '18%' };

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

export default function FileList({ items = [], loading, onDelete, onNavigate }) {
  const T = useT();
  const { selectedItems, toggleSelect, selectAll, clearSelection, setInfoItem, openOperation, sortBy, setSortBy, sortOrder, setSortOrder } = useFileManagerStore();

  const allSelected = items.length > 0 && items.every(i => selectedItems.has(i.path));

  const handleSort = (key) => {
    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortOrder('asc'); }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <Box sx={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${T.glassBorder}`,
        borderTopColor: T.teal, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Box>
  );

  if (items.length === 0) return (
    <Box sx={{ py: 8, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 14, color: T.textMuted }}>No files found</Typography>
    </Box>
  );

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header row */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 2, py: 0.75, borderBottom: `1px solid ${T.border}`,
        position: 'sticky', top: 0, bgcolor: T.adminBg, zIndex: 1,
      }}>
        <Checkbox
          size="small" checked={allSelected}
          onChange={() => allSelected ? clearSelection() : selectAll(items)}
          sx={{ p: 0.25, color: T.textFaint, '&.Mui-checked': { color: T.teal } }}
        />
        <HeaderCell label="Name"     sortKey="name"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.name} />
        <HeaderCell label="Size"     sortKey="size"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.size} />
        <HeaderCell label="Type"     sortKey="type"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.type} />
        <HeaderCell label="Modified" sortKey="modified" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} width={COL.modified} />
        <Box sx={{ width: COL.actions }} />
      </Box>

      {/* Rows */}
      <AnimatePresence>
        {items.map((item, idx) => {
          const selected = selectedItems.has(item.path);
          const color = getFileColor(item);
          return (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: Math.min(idx * 0.015, 0.3), duration: 0.15 }}
            >
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 2, py: 0.75,
                borderBottom: `1px solid ${T.border}`,
                bgcolor: selected ? T.tealBg : 'transparent',
                '&:hover': { bgcolor: selected ? T.tealBgHover : T.hoverBg },
                cursor: 'default', transition: 'background 0.1s',
              }}>
                <Checkbox
                  size="small" checked={selected}
                  onChange={() => toggleSelect(item.path)}
                  sx={{ p: 0.25, color: T.textFaint, '&.Mui-checked': { color: T.teal } }}
                />
                {/* Icon + name */}
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, width: COL.name, cursor: item.directory ? 'pointer' : 'default', overflow: 'hidden' }}
                  onDoubleClick={() => item.directory && onNavigate(item.path)}
                >
                  {item.directory
                    ? <FolderIcon sx={{ fontSize: 18, color }} />
                    : <InsertDriveFileIcon sx={{ fontSize: 18, color }} />}
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
                <Typography sx={{ width: COL.type, fontSize: 12, color: T.textMuted, textTransform: 'uppercase' }}>
                  {item.directory ? 'Folder' : (item.extension || '—')}
                </Typography>
                <Typography sx={{ width: COL.modified, fontSize: 12, color: T.textMuted }}>
                  {item.lastModified ? format(new Date(item.lastModified), 'MMM d, yyyy HH:mm') : '—'}
                </Typography>

                {/* Actions */}
                <Box sx={{ width: COL.actions, display: 'flex', gap: 0.25, justifyContent: 'flex-end' }}>
                  <Tooltip title="Info">
                    <IconButton size="small" onClick={() => setInfoItem(item)}
                      sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                      <InfoOutlinedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Rename">
                    <IconButton size="small" onClick={() => openOperation('rename', item)}
                      sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                      <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Move">
                    <IconButton size="small" onClick={() => openOperation('move', item)}
                      sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                      <DriveFileMoveIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                  {!item.directory && (
                    <Tooltip title="Download">
                      <IconButton size="small" onClick={() => downloadFile(item.path, item.name)}
                        sx={{ color: T.textFaint, '&:hover': { color: T.teal } }}>
                        <DownloadIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => onDelete(item)}
                      sx={{ color: T.textFaint, '&:hover': { color: '#ef4444' } }}>
                      <DeleteIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </Box>
  );
}
