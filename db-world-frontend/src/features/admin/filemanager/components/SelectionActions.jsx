import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useT } from '@shared/theme';
import { useFileManagerStore } from '../store/useFileManagerStore';

export default function SelectionActions({ isMobile, isPasting, onDownload, onCopy, onCut, onPaste, onMove, onDelete, onInfo }) {
  const T = useT();
  const selection = useFileManagerStore((s) => s.selection);
  const clearSelection = useFileManagerStore((s) => s.clearSelection);
  const clipboard = useFileManagerStore((s) => s.clipboard);
  const clearClipboard = useFileManagerStore((s) => s.clearClipboard);
  if (!selection.size && !clipboard?.items?.length) return null;

  const action = (label, Icon, onClick, color = T.textMuted, disabled = false) => (
    <Tooltip title={label} key={label}>
      <IconButton
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        sx={{ width: 44, height: 44, flexShrink: 0, color, '&:hover': { bgcolor: T.hoverBg, color: T.teal } }}
      >
        <Icon sx={{ fontSize: 19 }} />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box
      role="toolbar"
      aria-label="File selection actions"
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        px: 1.5, py: 0.5, bgcolor: isMobile ? T.sidebar : T.tealBg,
        borderTop: `1px solid ${T.border}`,
        ...(isMobile ? {
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1100,
          pb: 'calc(4px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
        } : {}),
      }}
    >
      {selection.size > 0 ? (
        <Chip
          label={`${selection.size} selected`} size="small" onDelete={clearSelection}
          aria-label={`${selection.size} selected, clear selection`}
          sx={{ flexShrink: 0, bgcolor: T.tealBgHover, color: T.teal, '& .MuiChip-deleteIcon': { color: T.teal } }}
        />
      ) : (
        <Typography sx={{ flexShrink: 0, fontSize: 12, color: T.textPrimary }}>
          {clipboard.items.length} ready
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', overflowX: 'auto', minWidth: 0, ml: 'auto' }}>
        {clipboard?.items?.length > 0 && action('Paste', ContentPasteIcon, onPaste, T.teal, isPasting)}
        {clipboard?.items?.length > 0 && action('Clear clipboard', CloseIcon, clearClipboard, T.textMuted, isPasting)}
        {selection.size > 0 && action('Download', DownloadIcon, onDownload)}
        {selection.size > 0 && action('Copy', ContentCopyIcon, onCopy)}
        {selection.size > 0 && action('Cut', ContentCutIcon, onCut, T.textMuted, isPasting)}
        {selection.size > 0 && action('Move', DriveFileMoveIcon, onMove)}
        {selection.size > 0 && action('Info', InfoOutlinedIcon, onInfo)}
        {selection.size > 0 && action('Delete', DeleteIcon, onDelete, T.error)}
      </Box>
    </Box>
  );
}
