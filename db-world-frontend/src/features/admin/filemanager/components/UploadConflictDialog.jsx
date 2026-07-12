import { forwardRef } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, IconButton, List, ListItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';

/** Fade + scale entrance/exit, wired into MUI's Dialog transition lifecycle. */
const Transition = forwardRef(function Transition(props, ref) {
  const { children, in: inProp, onEnter, onExited, ...other } = props;
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: inProp ? 1 : 0, scale: inProp ? 1 : 0.92 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onAnimationComplete={() => (inProp ? onEnter?.(true) : onExited?.())}
      {...other}
    >
      {children}
    </motion.div>
  );
});

/**
 * Themed prompt shown when an upload's file name(s) already exist in the
 * destination folder. Offers the three server-supported `onConflict`
 * strategies — overwrite the existing file, keep both (server picks a new
 * name), or skip the conflicting files and upload only the rest — instead of
 * silently failing the upload the way a bare `fail` conflict mode would.
 */
export default function UploadConflictDialog({
  open, names = [], onOverwrite, onKeepBoth, onSkip, onCancel,
}) {
  const T = useT();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      TransitionComponent={Transition}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { bgcolor: T.glass, backdropFilter: 'blur(16px)', border: `1px solid ${T.glassBorder}` },
      }}
    >
      <DialogTitle sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: T.textPrimary, fontSize: 15, fontWeight: 700, pb: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ fontSize: 18, color: T.error }} />
          File{names.length === 1 ? '' : 's'} already exist{names.length === 1 ? 's' : ''}
        </Box>
        <IconButton size="small" onClick={onCancel} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: 13, color: T.textMuted, mb: 1 }}>
          {names.length} file{names.length === 1 ? '' : 's'} already exist{names.length === 1 ? 's' : ''} here:
        </Typography>
        <List dense sx={{
          maxHeight: 160, overflowY: 'auto', bgcolor: T.glassHover, borderRadius: 1.5, py: 0.5,
        }}>
          {names.map((name) => (
            <ListItem key={name} sx={{ py: 0.25 }}>
              <Typography sx={{
                fontSize: 12.5, color: T.textPrimary,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {name}
              </Typography>
            </ListItem>
          ))}
        </List>
        <Typography sx={{ fontSize: 11.5, color: T.textFaint, mt: 1 }}>
          Keep both uploads the new file under a new name. Skip existing uploads only the files that don&apos;t already exist.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onCancel} sx={{ color: T.textMuted, fontSize: 13 }}>
          Cancel
        </Button>
        <Button
          onClick={onSkip}
          sx={{ color: T.textPrimary, fontSize: 13, border: `1px solid ${T.border}` }}
        >
          Skip existing
        </Button>
        <Button
          onClick={onKeepBoth}
          variant="contained"
          sx={{
            bgcolor: T.teal, fontSize: 13,
            '&:hover': { bgcolor: T.tealHover },
          }}
        >
          Keep both
        </Button>
        <Button
          onClick={onOverwrite}
          variant="contained"
          sx={{
            bgcolor: T.error, fontSize: 13,
            '&:hover': { bgcolor: T.error, filter: 'brightness(0.9)' },
          }}
        >
          Overwrite
        </Button>
      </DialogActions>
    </Dialog>
  );
}
