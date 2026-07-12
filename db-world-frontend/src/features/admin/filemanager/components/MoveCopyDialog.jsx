import { useRef } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, IconButton, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useT } from '@shared/theme';
import { moveItem, copyItem } from '../api/fileManagerApi';
import { useFileManagerStore } from '../store/useFileManagerStore';
import { useInvalidateFm } from '../hooks/useInvalidateFm';
import FolderTree from './FolderTree';

/**
 * Move/copy `items` (within a single `locationId`) to a destination folder
 * picked from the location's `FolderTree`. `FolderTree` has no dedicated
 * "picker" mode — clicking a node calls the shared store's `navigate(path)`,
 * the same action the main content pane uses to browse — so this dialog
 * reuses that as the pick mechanism (the clicked/active path IS the chosen
 * destination) and restores whatever path was active before the dialog
 * opened on close, so browsing the tree here never leaves the main pane
 * navigated somewhere the user didn't ask to go.
 */
export default function MoveCopyDialog({ open, onClose, mode, items = [], locationId }) {
  const T = useT();
  const { enqueueSnackbar } = useSnackbar();
  const { invalidateDir } = useInvalidateFm();
  const destinationPath = useFileManagerStore((s) => s.path);
  const navigate = useFileManagerStore((s) => s.navigate);

  // Captured once per open (render-time, not an effect — see the doc comment
  // above): the path the main pane was on right before this dialog opened.
  const wasOpenRef = useRef(false);
  const restorePathRef = useRef('/');
  if (open && !wasOpenRef.current) restorePathRef.current = destinationPath;
  wasOpenRef.current = open;

  const opLabel = mode === 'copy' ? 'Copy' : 'Move';
  const verbPast = mode === 'copy' ? 'Copied' : 'Moved';
  const runOne = mode === 'copy' ? copyItem : moveItem;

  const { mutate: confirm, isPending } = useMutation({
    mutationFn: () => Promise.allSettled(
      items.map((item) => runOne({ locationId, sourcePath: item.path, destinationPath }))
    ),
    onSuccess: (results) => {
      invalidateDir(locationId);
      const failed = results
        .map((r, i) => ({ r, item: items[i] }))
        .filter(({ r }) => r.status === 'rejected');

      if (failed.length === 0) {
        enqueueSnackbar(`${verbPast} ${items.length} item${items.length === 1 ? '' : 's'}`, { variant: 'success' });
      } else if (failed.length === items.length) {
        const msg = failed[0].r.reason?.response?.data?.message ?? `Failed to ${mode} ${items.length === 1 ? 'item' : 'items'}`;
        enqueueSnackbar(msg, { variant: 'error' });
      } else {
        enqueueSnackbar(
          `${verbPast} ${items.length - failed.length}/${items.length} — failed: ${failed.map((f) => f.item.name).join(', ')}`,
          { variant: 'warning' }
        );
      }
      handleClose();
    },
    onError: (e) => enqueueSnackbar(e?.response?.data?.message ?? `Failed to ${mode} items`, { variant: 'error' }),
  });

  function handleClose() {
    navigate(restorePathRef.current);
    onClose?.();
  }

  return (
    <Dialog
      open={open}
      onClose={isPending ? undefined : handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: T.sidebar, border: `1px solid ${T.border}`, height: 480 } }}
    >
      <DialogTitle sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: T.textPrimary, fontSize: 15, fontWeight: 700, pb: 1,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DriveFileMoveIcon sx={{ fontSize: 18, color: T.teal }} />
          {opLabel} {items.length} item{items.length === 1 ? '' : 's'}
        </span>
        <IconButton size="small" onClick={handleClose} disabled={isPending} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 1, display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
        <Typography sx={{ fontSize: 12, color: T.textFaint }}>
          Choose a destination folder:
        </Typography>
        <Box sx={{ flex: 1, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 1.5, py: 0.5 }}>
          <FolderTree locationId={locationId} />
        </Box>
        <Typography sx={{ fontSize: 12, color: T.teal, fontWeight: 600, wordBreak: 'break-all' }}>
          Destination: {destinationPath}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={isPending} sx={{ color: T.textMuted, fontSize: 13 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => confirm()}
          disabled={isPending || items.length === 0}
          sx={{ bgcolor: T.teal, fontSize: 13, '&:hover': { bgcolor: T.tealHover } }}
        >
          {isPending ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : opLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
