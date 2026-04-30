import { Box, Typography, IconButton, Tooltip, Checkbox } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { getFileColor, getFileEmoji } from './fileIcons';
import { downloadFile } from './fileManagerApi';

function FileCard({ item, onNavigate, onDelete }) {
  const T = useT();
  const { selectedItems, toggleSelect, setInfoItem, openOperation } = useFileManagerStore();
  const selected = selectedItems.has(item.path);
  const color = getFileColor(item);
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <Box
      onDoubleClick={() => item.directory && onNavigate(item.path)}
      sx={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        p: 1.5, borderRadius: 2, gap: 0.75,
        border: `1px solid ${selected ? T.teal : T.border}`,
        bgcolor: selected ? T.tealBg : T.cardBg ?? T.adminBg,
        cursor: item.directory ? 'pointer' : 'default',
        transition: 'all 0.15s',
        '&:hover': { borderColor: T.teal, bgcolor: T.tealBg ?? T.hoverBg },
        minWidth: 0, overflow: 'hidden',
      }}
    >
      {/* Select checkbox */}
      <Checkbox
        size="small" checked={selected}
        onChange={() => toggleSelect(item.path)}
        onClick={e => e.stopPropagation()}
        sx={{
          position: 'absolute', top: 2, left: 2, p: 0.25,
          color: T.textFaint, '&.Mui-checked': { color: T.teal },
        }}
      />

      {/* Context menu */}
      <IconButton
        size="small"
        onClick={e => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
        sx={{ position: 'absolute', top: 2, right: 2, color: T.textFaint, '&:hover': { color: T.teal } }}
      >
        <MoreVertIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { bgcolor: T.cardBg ?? T.sidebar, border: `1px solid ${T.border}`, minWidth: 160 } }}>
        <MenuItem onClick={() => { setInfoItem(item); setAnchorEl(null); }}
          sx={{ fontSize: 13, color: T.textPrimary }}>Info</MenuItem>
        <MenuItem onClick={() => { openOperation('rename', item); setAnchorEl(null); }}
          sx={{ fontSize: 13, color: T.textPrimary }}>Rename</MenuItem>
        <MenuItem onClick={() => { openOperation('move', item); setAnchorEl(null); }}
          sx={{ fontSize: 13, color: T.textPrimary }}>Move</MenuItem>
        <MenuItem onClick={() => { openOperation('copy', item); setAnchorEl(null); }}
          sx={{ fontSize: 13, color: T.textPrimary }}>Copy</MenuItem>
        {!item.directory && (
          <MenuItem onClick={() => { downloadFile(item.path, item.name); setAnchorEl(null); }}
            sx={{ fontSize: 13, color: T.textPrimary }}>Download</MenuItem>
        )}
        <MenuItem onClick={() => { onDelete(item); setAnchorEl(null); }}
          sx={{ fontSize: 13, color: '#ef4444' }}>Delete</MenuItem>
      </Menu>

      {/* Icon */}
      <Box sx={{
        width: 44, height: 44, borderRadius: 2,
        bgcolor: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {item.directory
          ? <FolderIcon sx={{ fontSize: 26, color }} />
          : <InsertDriveFileIcon sx={{ fontSize: 26, color }} />}
      </Box>

      {/* Name */}
      <Typography sx={{
        fontSize: 12, fontWeight: item.directory ? 600 : 400, color: T.textPrimary,
        textAlign: 'center', width: '100%',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {item.name}
      </Typography>

      {/* Size */}
      <Typography sx={{ fontSize: 10, color: T.textFaint }}>
        {item.directory ? `${item.childCount} items` : item.formattedSize}
      </Typography>
    </Box>
  );
}

export default function FileGrid({ items = [], loading, onDelete, onNavigate }) {
  const T = useT();

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
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
      gap: 1.5, p: 2,
    }}>
      <AnimatePresence>
        {items.map((item, idx) => (
          <motion.div
            key={item.path}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: Math.min(idx * 0.02, 0.4), duration: 0.15 }}
          >
            <FileCard item={item} onNavigate={onNavigate} onDelete={onDelete} />
          </motion.div>
        ))}
      </AnimatePresence>
    </Box>
  );
}
