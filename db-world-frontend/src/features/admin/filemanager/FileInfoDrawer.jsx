import {
  Drawer, Box, Typography, IconButton, Divider, Chip, Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import { format } from 'date-fns';
import { useT } from '@shared/theme';
import { useFileManagerStore } from './useFileManagerStore';
import { getFileColor } from './fileIcons';
import { downloadFile } from './fileManagerApi';

const Row = ({ label, value }) => {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, gap: 1 }}>
      <Typography sx={{ fontSize: 12, color: T.textFaint, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, color: T.textPrimary, textAlign: 'right', wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
  );
};

export default function FileInfoDrawer({ onDelete }) {
  const T = useT();
  const { infoItem, clearInfoItem, openOperation } = useFileManagerStore();
  const item = infoItem;

  if (!item) return null;

  const color = getFileColor(item);

  return (
    <Drawer
      anchor="right"
      open={Boolean(item)}
      onClose={clearInfoItem}
      PaperProps={{
        sx: {
          width: { xs: '85vw', sm: 320 },
          bgcolor: T.sidebar, border: 'none',
          borderLeft: `1px solid ${T.border}`,
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1.5, borderBottom: `1px solid ${T.border}`,
        }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>File Info</Typography>
          <IconButton size="small" onClick={clearInfoItem} sx={{ color: T.textFaint }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Icon + name */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 1.5 }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: 2.5,
            bgcolor: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {item.directory
              ? <FolderIcon sx={{ fontSize: 36, color }} />
              : <InsertDriveFileIcon sx={{ fontSize: 36, color }} />}
          </Box>
          <Typography sx={{
            fontSize: 15, fontWeight: 700, color: T.textPrimary,
            textAlign: 'center', px: 2, wordBreak: 'break-word',
          }}>
            {item.name}
          </Typography>
          <Chip
            label={item.directory ? 'Folder' : (item.extension?.toUpperCase() || 'File')}
            size="small"
            sx={{ fontSize: 11, bgcolor: `${color}22`, color, border: 'none' }}
          />
        </Box>

        <Divider sx={{ borderColor: T.border }} />

        {/* Details */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>
          <Row label="Path"     value={item.path} />
          <Row label="Size"     value={item.directory ? `${item.childCount} items` : item.formattedSize} />
          {!item.directory && <Row label="MIME Type" value={item.mimeType || '—'} />}
          {item.lastModified && (
            <Row label="Modified" value={format(new Date(item.lastModified), 'MMM d, yyyy HH:mm')} />
          )}
          {item.createdAt && (
            <Row label="Created" value={format(new Date(item.createdAt), 'MMM d, yyyy HH:mm')} />
          )}
          <Row label="Readable" value={item.readable ? 'Yes' : 'No'} />
          <Row label="Writable" value={item.writable ? 'Yes' : 'No'} />
        </Box>

        <Divider sx={{ borderColor: T.border }} />

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, p: 1.5, flexWrap: 'wrap' }}>
          <Tooltip title="Rename">
            <IconButton size="small" onClick={() => openOperation('rename', item)}
              sx={{ color: T.textMuted, bgcolor: T.hoverBg, borderRadius: 1.5, '&:hover': { color: T.teal } }}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Move">
            <IconButton size="small" onClick={() => openOperation('move', item)}
              sx={{ color: T.textMuted, bgcolor: T.hoverBg, borderRadius: 1.5, '&:hover': { color: T.teal } }}>
              <DriveFileMoveIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          {!item.directory && (
            <Tooltip title="Download">
              <IconButton size="small" onClick={() => downloadFile(item.path, item.name)}
                sx={{ color: T.textMuted, bgcolor: T.hoverBg, borderRadius: 1.5, '&:hover': { color: T.teal } }}>
                <DownloadIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => { onDelete(item); clearInfoItem(); }}
              sx={{ color: '#ef4444', bgcolor: '#ef444422', borderRadius: 1.5, '&:hover': { bgcolor: '#ef444433' } }}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Drawer>
  );
}
