import { Drawer, Box, Typography, IconButton, Divider, Chip, Tooltip } from '@mui/material';
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

/**
 * Right-side details drawer for a single file/folder. `open` and `item` are
 * separate props so the caller can keep `item` populated through the close
 * transition (avoids the content flashing empty as the drawer slides out).
 */
export default function InfoDrawer({ open, item, onClose, onDownload, onRename, onDelete }) {
  const T = useT();
  const { data: locations = [] } = useLocations();
  const location = locations.find((l) => l.id === item?.locationId);

  return (
    <Drawer
      anchor="right"
      open={Boolean(open && item)}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '85vw', sm: 320 },
          bgcolor: T.glass, backdropFilter: 'blur(16px)',
          border: 'none', borderLeft: `1px solid ${T.glassBorder}`,
        },
      }}
    >
      {item && (
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
              <ThumbnailImage item={item} fill borderRadius={2.5} />
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
              sx={{ fontSize: 11, bgcolor: T.tealBg, color: T.teal, border: 'none' }}
            />
          </Box>

          <Divider sx={{ borderColor: T.border }} />

          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>
            <Row label="Path" value={item.path} />
            {location && <Row label="Location" value={location.label} />}
            <Row
              label="Size"
              value={item.directory
                ? (item.childCount > 0 ? `${item.childCount} items` : 'Folder')
                : item.formattedSize}
            />
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

          <Box sx={{ display: 'flex', gap: 1, p: 1.5, flexWrap: 'wrap' }}>
            {!item.directory && (
              <Tooltip title="Download">
                <IconButton
                  size="small"
                  onClick={() => onDownload?.(item)}
                  sx={{ color: T.textMuted, bgcolor: T.hoverBg, borderRadius: 1.5, '&:hover': { color: T.teal } }}
                >
                  <DownloadIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Rename">
              <IconButton
                size="small"
                onClick={() => onRename?.(item)}
                sx={{ color: T.textMuted, bgcolor: T.hoverBg, borderRadius: 1.5, '&:hover': { color: T.teal } }}
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => onDelete?.(item)}
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
