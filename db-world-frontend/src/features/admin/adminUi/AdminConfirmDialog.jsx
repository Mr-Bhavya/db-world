import { useId } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteForeverRounded from '@mui/icons-material/DeleteForeverRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { useT } from '@shared/theme';
import { alpha } from '@mui/material/styles';
import SheetDialog from '@shared/components/SheetDialog';
import { adminSurface } from './theme';

export default function AdminConfirmDialog({
  open,
  title,
  message,
  children,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
  ...dialogProps
}) {
  const T = useT();
  const S = adminSurface(T);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const accent = danger ? T.error : T.teal;
  const id = useId();
  const titleId = `${id}-admin-confirm-title`;
  const descriptionId = `${id}-admin-confirm-description`;
  const handleClose = (_, reason) => {
    if (!loading && reason !== 'backdropClick') onClose?.();
  };

  return (
    <SheetDialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      slotProps={{
        paper: {
          sx: {
            bgcolor: S.card,
            color: T.text,
            borderRadius: 3,
            border: `1px solid ${alpha(accent, danger ? 0.28 : 0.18)}`,
            backgroundImage: 'none',
          },
        },
      }}
      {...dialogProps}
    >
      <DialogTitle sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 1.5,
        px: { xs: 2.25, sm: 3 },
        pt: { xs: 2.25, sm: 3 },
        pb: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, minWidth: 0 }}>
          <Box sx={{
            width: 5,
            height: 5,
            flex: '0 0 auto',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 2,
            color: accent,
            bgcolor: alpha(accent, 0.12),
            border: `1px solid ${alpha(accent, 0.24)}`,
          }}>
            {danger
              ? <DeleteForeverRounded aria-hidden="true" fontSize="small" />
              : <InfoOutlined aria-hidden="true" fontSize="small" />}
          </Box>
          <Box sx={{ minWidth: 0, pt: 0.35 }}>
            <Typography
              id={titleId}
              component="h2"
              sx={{ color: T.text, fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere' }}
            >
              {title}
            </Typography>
          </Box>
        </Box>
        <IconButton
          aria-label="Close confirmation"
          onClick={onClose}
          disabled={loading}
          sx={{ color: T.textFaint, width: 5.5, height: 5.5, mt: -0.75, mr: -0.75 }}
        >
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent id={descriptionId} sx={{ px: { xs: 2.25, sm: 3 }, pt: 0.75, pb: 1.5 }}>
        {message && (
          <Typography sx={{ color: T.textMuted, fontSize: '0.9rem', lineHeight: 1.65 }}>
            {message}
          </Typography>
        )}
        {children}
      </DialogContent>

      <DialogActions sx={{
        display: 'flex',
        flexDirection: { xs: 'column-reverse', sm: 'row' },
        alignItems: 'stretch',
        px: { xs: 2.25, sm: 3 },
        // Safe-area composition is a platform value, not a theme spacing token.
        pb: { xs: 'max(20px, env(safe-area-inset-bottom))', sm: 3 }, // ds-allow-hardcode
        pt: 0.5,
        gap: 1,
        '& > :not(style) ~ :not(style)': { ml: 0 },
      }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={loading}
          sx={{
            minHeight: 5.5,
            flex: isMobile ? 1 : undefined,
            color: T.textMuted,
            borderColor: S.border,
            textTransform: 'none',
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={danger ? 'error' : 'primary'}
          onClick={onConfirm}
          disabled={loading || confirmDisabled}
          startIcon={loading ? <CircularProgress size={17} color="inherit" /> : null}
          sx={{
            minHeight: 5.5,
            minWidth: { sm: 132 },
            flex: isMobile ? 1 : undefined,
            fontWeight: 750,
            textTransform: 'none',
            boxShadow: 'none',
            bgcolor: accent,
            '&:hover': { bgcolor: accent, filter: 'brightness(.9)', boxShadow: 'none' },
          }}
        >
          {loading ? 'Working...' : confirmLabel}
        </Button>
      </DialogActions>
    </SheetDialog>
  );
}
