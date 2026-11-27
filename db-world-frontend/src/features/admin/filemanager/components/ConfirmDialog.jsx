import { forwardRef } from 'react';
import {
  Box,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { motion } from 'framer-motion';
import { useT } from '@shared/theme';
import SheetDialog from '@shared/components/SheetDialog';

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
    <SheetDialog
      open={open}
      onClose={onClose}
      asSheet={false}
      TransitionComponent={Transition}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: T.bg,
          color: T.textPrimary,
          borderRadius: 4,
          border: `1px solid ${danger ? T.errorBg : T.glassBorder}`,
          boxShadow: '0 28px 90px rgba(0, 0, 0, 0.42)',
        },
      }}
    >
      <DialogTitle sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: T.textPrimary, fontSize: 16, fontWeight: 700, pb: 1.25,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, pr: 1 }}>
          {danger && <WarningAmberIcon sx={{ flexShrink: 0, fontSize: 21, color: T.error }} />}
          <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{title}</Box>
        </Box>
        <IconButton
          size="small"
          aria-label="Close confirmation"
          onClick={onClose}
          sx={{ flexShrink: 0, color: T.textFaint, width: 40, height: 40 }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0, pb: 1.5 }}>
        <Typography sx={{ fontSize: 14, lineHeight: 1.65, color: T.textMuted }}>{message}</Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} sx={{ minHeight: 42, px: 2, color: T.textMuted, fontSize: 13 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          sx={{
            minHeight: 42, px: 2.5, borderRadius: 2.5, bgcolor: accent, fontSize: 13,
            fontWeight: 700, boxShadow: 'none',
            '&:hover': { bgcolor: accent, filter: 'brightness(0.9)', boxShadow: 'none' },
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </SheetDialog>
  );
}
