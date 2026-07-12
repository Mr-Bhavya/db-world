import { Drawer, Box, Typography, IconButton, Divider, Chip, Tooltip, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { format } from 'date-fns';
import { useT } from '@shared/theme';
import { useLocations } from '../hooks/useLocations';
import ThumbnailImage from './ThumbnailImage';

function Row({ label, value }) {
  const T = useT();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, gap: 1 }}>
      <Typography sx={{ fontSize: 12, color: T.textFaint, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, color: T.textPrimary, textAlign: 'right', wordBreak: 'break-all' }}>
        {value}
      </Typography>
    </Box>
  );
}

/** Formats a byte count as a human-readable B/KB/MB/GB string. */
function formatBytes(n) {
  if (!n || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = n;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  return `${unitIdx === 0 ? value : value.toFixed(1)} ${units[unitIdx]}`;
}

/**
 * Right-side details drawer for the current selection. `items` holds one or
 * more `FileItemDto`s — a single item renders the full single-item detail
 * view (thumbnail, path/size/mime/etc, rename/download/delete); more than one
 * renders an aggregate summary (count, total size, name list) with
 * download-all/delete-all actions. `open` and `items` are separate props so
 * the caller can keep `items` populated through the close transition (avoids
 * the content flashing empty as the drawer slides out).
 */
export default function InfoDrawer({ open, items = [], onClose, onDownload, onRename, onDelete }) {
  const T = useT();
  const { data: locations = [] } = useLocations();
  const single = items.length === 1 ? items[0] : null;
  const location = locations.find((l) => l.id === single?.locationId);

  const fileCount = items.filter((i) => !i.directory).length;
  const folderCount = items.length - fileCount;
  const totalSize = items.reduce((sum, i) => (i.directory ? sum : sum + (i.sizeBytes || 0)), 0);

  return (
    <Drawer
      anchor="right"
      open={Boolean(open && items.length > 0)}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '85vw', sm: 320 },
          bgcolor: T.glass, backdropFilter: 'blur(16px)',
          border: 'none', borderLeft: `1px solid ${T.glassBorder}`,
        },
      }}
    >
      {items.length > 1 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2, py: 1.5, borderBottom: `1px solid ${T.border}`,
          }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>File Info</Typography>
            <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>
              {items.length} items selected
            </Typography>
            <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.5 }}>
              {fileCount} file{fileCount === 1 ? '' : 's'} · {folderCount} folder{folderCount === 1 ? '' : 's'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: T.textMuted, mt: 0.25 }}>
              Total size: {formatBytes(totalSize)}
            </Typography>
          </Box>

          <Divider sx={{ borderColor: T.border }} />

          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>
            {items.map((i) => (
              <Typography
                key={i.path}
                sx={{
                  fontSize: 12.5, color: T.textPrimary, py: 0.5,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {i.name}
              </Typography>
            ))}
          </Box>

          <Divider sx={{ borderColor: T.border }} />

          <Box sx={{ display: 'flex', gap: 1, p: 1.5 }}>
            {fileCount > 0 && (
              <Button
                size="small"
                startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                onClick={() => onDownload?.(items)}
                sx={{ color: T.textMuted, bgcolor: T.hoverBg, borderRadius: 1.5, fontSize: 12.5, '&:hover': { color: T.teal } }}
              >
                Download
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
              onClick={() => onDelete?.(items)}
              sx={{ color: T.error, bgcolor: T.errorBg, borderRadius: 1.5, fontSize: 12.5, '&:hover': { bgcolor: T.errorBg, filter: 'brightness(0.9)' } }}
            >
              Delete
            </Button>
          </Box>
        </Box>
      ) : single && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2, py: 1.5, borderBottom: `1px solid ${T.border}`,
          }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>File Info</Typography>
            <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 1.5 }}>
            <Box sx={{ width: 84, height: 84 }}>
              <ThumbnailImage item={single} fill borderRadius={2.5} />
            </Box>
            <Typography sx={{
              fontSize: 15, fontWeight: 700, color: T.textPrimary,
              textAlign: 'center', px: 2, wordBreak: 'break-word',
            }}>
              {single.name}
            </Typography>
            <Chip
              label={single.directory ? 'Folder' : (single.extension?.toUpperCase() || 'File')}
              size="small"
              sx={{ fontSize: 11, bgcolor: T.tealBg, color: T.teal, border: 'none' }}
            />
          </Box>

          <Divider sx={{ borderColor: T.border }} />

          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>
            <Row label="Path" value={single.path} />
            {location && <Row label="Location" value={location.label} />}
            <Row
              label="Size"
              value={single.directory
                ? (single.childCount > 0 ? `${single.childCount} items` : 'Folder')
                : single.formattedSize}
            />
            {!single.directory && <Row label="MIME Type" value={single.mimeType || '—'} />}
            {single.lastModified && (
              <Row label="Modified" value={format(new Date(single.lastModified), 'MMM d, yyyy HH:mm')} />
            )}
            {single.createdAt && (
              <Row label="Created" value={format(new Date(single.createdAt), 'MMM d, yyyy HH:mm')} />
            )}
            <Row label="Readable" value={single.readable ? 'Yes' : 'No'} />
            <Row label="Writable" value={single.writable ? 'Yes' : 'No'} />
          </Box>

          <Divider sx={{ borderColor: T.border }} />

          <Box sx={{ display: 'flex', gap: 1, p: 1.5, flexWrap: 'wrap' }}>
            {!single.directory && (
              <Tooltip title="Download">
                <IconButton
                  size="small"
                  onClick={() => onDownload?.(single)}
                  sx={{ color: T.textMuted, bgcolor: T.hoverBg, borderRadius: 1.5, '&:hover': { color: T.teal } }}
                >
                  <DownloadIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Rename">
              <IconButton
                size="small"
                onClick={() => onRename?.(single)}
                sx={{ color: T.textMuted, bgcolor: T.hoverBg, borderRadius: 1.5, '&:hover': { color: T.teal } }}
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => onDelete?.(single)}
                sx={{ color: T.error, bgcolor: T.errorBg, borderRadius: 1.5, '&:hover': { bgcolor: T.errorBg, filter: 'brightness(0.9)' } }}
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
