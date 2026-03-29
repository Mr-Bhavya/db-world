import { Box, Typography, IconButton, Divider } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { format } from 'date-fns';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { getFileColor } from './fileIcons';
import { getDownloadUrl } from './fileManagerApi';

export default function FileMobileList({ items = [], loading, onDelete, onNavigate }) {
  const T = useT();
  const { setInfoItem, openOperation } = useFileManagerStore();
  const [menuState, setMenuState] = useState({ anchor: null, item: null });

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <Box sx={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${T.glassBorder}`,
        borderTopColor: T.teal, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Box>
  );

  if (items.length === 0) return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 14, color: T.textMuted }}>No files found</Typography>
    </Box>
  );

  return (
    <Box>
      {items.map((item, idx) => {
        const color = getFileColor(item);
        return (
          <Box key={item.path}>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 2, py: 1.25,
                '&:active': { bgcolor: T.hoverBg },
              }}
              onClick={() => item.directory && onNavigate(item.path)}
            >
              {/* File type icon */}
              <Box sx={{
                width: 38, height: 38, borderRadius: 1.5, flexShrink: 0,
                bgcolor: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.directory
                  ? <FolderIcon sx={{ fontSize: 20, color }} />
                  : <InsertDriveFileIcon sx={{ fontSize: 20, color }} />}
              </Box>

              {/* Name + meta */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{
                  fontSize: 14, fontWeight: item.directory ? 600 : 400, color: T.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.name}
                </Typography>
                <Typography sx={{ fontSize: 11, color: T.textFaint }}>
                  {item.directory
                    ? `${item.childCount} items`
                    : item.formattedSize}
                  {item.lastModified && ` · ${format(new Date(item.lastModified), 'MMM d, yyyy')}`}
                </Typography>
              </Box>

              {item.directory && <ChevronRightIcon sx={{ fontSize: 16, color: T.textFaint }} />}

              {/* More menu */}
              <IconButton
                size="small"
                onClick={e => { e.stopPropagation(); setMenuState({ anchor: e.currentTarget, item }); }}
                sx={{ color: T.textFaint }}
              >
                <MoreVertIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
            {idx < items.length - 1 && <Divider sx={{ borderColor: T.border, mx: 2 }} />}
          </Box>
        );
      })}

      <Menu
        anchorEl={menuState.anchor}
        open={Boolean(menuState.anchor)}
        onClose={() => setMenuState({ anchor: null, item: null })}
        PaperProps={{ sx: { bgcolor: T.cardBg ?? T.sidebar, border: `1px solid ${T.border}`, minWidth: 160 } }}
      >
        {menuState.item && [
          <MenuItem key="info" onClick={() => { setInfoItem(menuState.item); setMenuState({ anchor: null, item: null }); }}
            sx={{ fontSize: 13, color: T.textPrimary }}>Info</MenuItem>,
          <MenuItem key="rename" onClick={() => { openOperation('rename', menuState.item); setMenuState({ anchor: null, item: null }); }}
            sx={{ fontSize: 13, color: T.textPrimary }}>Rename</MenuItem>,
          <MenuItem key="move" onClick={() => { openOperation('move', menuState.item); setMenuState({ anchor: null, item: null }); }}
            sx={{ fontSize: 13, color: T.textPrimary }}>Move to…</MenuItem>,
          <MenuItem key="copy" onClick={() => { openOperation('copy', menuState.item); setMenuState({ anchor: null, item: null }); }}
            sx={{ fontSize: 13, color: T.textPrimary }}>Copy to…</MenuItem>,
          !menuState.item?.directory && (
            <MenuItem key="dl" component="a" href={getDownloadUrl(menuState.item?.path ?? '')} download
              onClick={() => setMenuState({ anchor: null, item: null })} sx={{ fontSize: 13, color: T.textPrimary }}>Download</MenuItem>
          ),
          <MenuItem key="delete" onClick={() => { onDelete(menuState.item); setMenuState({ anchor: null, item: null }); }}
            sx={{ fontSize: 13, color: '#ef4444' }}>Delete</MenuItem>,
        ]}
      </Menu>
    </Box>
  );
}
