import { forwardRef } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, IconButton,
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
 * Themed yes/no confirmation dialog. Used for delete and other destructive
 * (or merely confirm-worthy) actions across the file manager — no
 * `window.confirm`, ever.
 */
export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Delete', danger = true, onConfirm, onClose,
}) {
  const T = useT();
  const accent = danger ? T.error : T.teal;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={Transition}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: T.glass,
          backdropFilter: 'blur(16px)',
          border: `1px solid ${danger ? T.errorBg : T.glassBorder}`,
        },
      }}
    >
      <DialogTitle sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: T.textPrimary, fontSize: 15, fontWeight: 700, pb: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {danger && <WarningAmberIcon sx={{ fontSize: 18, color: T.error }} />}
          {title}
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: T.textFaint }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: 13, color: T.textMuted }}>{message}</Typography>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: T.textMuted, fontSize: 13 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          sx={{
            bgcolor: accent, fontSize: 13,
            '&:hover': { bgcolor: accent, filter: 'brightness(0.9)' },
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
