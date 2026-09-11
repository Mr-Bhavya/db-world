import { useEffect, useState } from 'react';
import { Box, Typography, Dialog, IconButton, Button, LinearProgress } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import { useT } from '@shared/theme';
import { formatFileSize } from '../utils/walletFormat';

/**
 * Shared chrome for the two wallet forms.
 *
 * They were stock MUI dialogs — `bgcolor: T.sidebar`, default paddings, a plain title row — which
 * read as a different application from the glass surfaces around them. Everything here is the same
 * token set the cards and the detail page use, so the forms belong to the app they open from.
 */

/** Input styling applied to every field in both forms, so none of them drift. */
export const walletFieldSx = (T) => ({
  '& .MuiInputBase-input': { color: T.textPrimary, fontSize: 14 },
  '& .MuiInputBase-root': { bgcolor: T.glass, borderRadius: 2 },
  '& .MuiInputLabel-root': { color: T.textMuted, fontSize: 13.5 },
  '& .MuiInputLabel-root.Mui-focused': { color: T.teal },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: T.border },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: T.borderHover },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: T.teal, borderWidth: 1 },
  '& .MuiFormHelperText-root': { fontSize: 10.5, mx: 0, color: T.textMuted },
  '& input::-webkit-calendar-picker-indicator': { filter: 'invert(0.5)', cursor: 'pointer' },
});

/**
 * Dialog shell with a sticky header and footer.
 *
 * Sticky matters on a phone, where these go full-screen: with the actions at the natural end of the
 * document, a form long enough to scroll hid its own Save button, and the only way to find out was
 * to scroll to the bottom of a form you had just filled in.
 */
export function WalletFormDialog({ open, onClose, title, subtitle, busy, actions, fullScreen, children }) {
  const T = useT();
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      slotProps={{
        paper: {
          sx: {
            bgcolor: T.bg,
            backgroundImage: 'none',
            border: fullScreen ? 'none' : `1px solid ${T.glassBorder}`,
            borderRadius: fullScreen ? 0 : 3.5,
          },
        },
      }}
    >
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 2, bgcolor: T.bg,
        px: { xs: 2, sm: 2.5 }, pt: { xs: 2, sm: 2.5 }, pb: 1.5,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: { xs: 17, sm: 19 }, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.3 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography sx={{ fontSize: 12.5, color: T.textMuted, mt: 0.25 }}>{subtitle}</Typography>
            )}
          </Box>
          <IconButton
            size="small"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            sx={{ color: T.textMuted, flexShrink: 0, mt: -0.5, mr: -0.5 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {children}
      </Box>

      <Box sx={{
        position: 'sticky', bottom: 0, zIndex: 2, bgcolor: T.bg,
        px: { xs: 2, sm: 2.5 }, py: 1.5, borderTop: `1px solid ${T.border}`,
        display: 'flex', justifyContent: 'flex-end', gap: 1,
      }}>
        {actions}
      </Box>
    </Dialog>
  );
}

/** A labelled group of fields. Gives the form a rhythm you can scan, instead of one undifferentiated
 * column of inputs. */
export function FormSection({ title, hint, children }) {
  const T = useT();
  return (
    <Box>
      <Typography sx={{
        fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase',
        color: T.textMuted, mb: hint ? 0.25 : 1,
      }}>
        {title}
      </Typography>
      {hint && <Typography sx={{ fontSize: 11.5, color: T.textFaint, mb: 1, lineHeight: 1.5 }}>{hint}</Typography>}
      {children}
    </Box>
  );
}

/**
 * File picker that shows what you picked.
 *
 * The old dropzone was a dashed box that only ever changed its caption to the file name, so after
 * choosing an image there was nothing to confirm you had picked the right one — which for a wallet
 * of near-identical ID scans is exactly the moment you want to look. It now renders a real
 * thumbnail for images, a marked tile for PDFs, and the name and size beside it.
 */
export function FilePickField({ file, onPick, accept, maxBytes, disabled, progress }) {
  const T = useT();
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file || !String(file.type).startsWith('image/')) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const inputId = 'wallet-file-input';

  if (!file) {
    return (
      <Box
        component="label"
        htmlFor={inputId}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0]); }}
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 0.75, py: 3.5, px: 2, cursor: 'pointer', textAlign: 'center',
          border: `1px dashed ${T.border}`, borderRadius: 3, bgcolor: T.glass,
          transition: 'border-color 0.2s ease, background-color 0.2s ease',
          '&:hover': { borderColor: T.teal, bgcolor: T.tealBg },
        }}
      >
        <Box sx={{
          width: 44, height: 44, borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', bgcolor: T.tealBg,
        }}>
          <CloudUploadOutlinedIcon sx={{ fontSize: 22, color: T.teal }} />
        </Box>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: T.textPrimary }}>
          Choose a file or drop it here
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: T.textMuted }}>
          PDF, PNG or JPEG · up to {Math.round(maxBytes / (1024 * 1024))} MB
        </Typography>
        <input id={inputId} type="file" hidden accept={accept} onChange={(e) => onPick(e.target.files?.[0])} />
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25,
      border: `1px solid ${T.border}`, borderRadius: 3, bgcolor: T.glass, minWidth: 0,
    }}>
      <Box sx={{
        width: 56, height: 56, borderRadius: 2, flexShrink: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: T.glassHover, border: `1px solid ${T.border}`,
      }}>
        {preview
          ? <Box component="img" src={preview} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <PictureAsPdfOutlinedIcon sx={{ fontSize: 26, color: T.teal }} />}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: T.textPrimary }} noWrap>
          {file.name}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: T.textMuted, mt: 0.15 }}>
          {formatFileSize(file.size) ?? ''}
        </Typography>
        {progress > 0 && progress < 100 && (
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ mt: 0.75, borderRadius: 999, bgcolor: T.glassHover, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }}
          />
        )}
      </Box>
      <Button
        component="label"
        size="small"
        disabled={disabled}
        startIcon={<AutorenewRoundedIcon sx={{ fontSize: 16 }} />}
        sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700, fontSize: 12.5, color: T.teal }}
      >
        Change
        <input type="file" hidden accept={accept} onChange={(e) => onPick(e.target.files?.[0])} />
      </Button>
    </Box>
  );
}

/** Primary / secondary buttons, styled once so both forms agree. */
export function PrimaryButton({ children, ...rest }) {
  const T = useT();
  return (
    <Button
      variant="contained"
      {...rest}
      sx={{ textTransform: 'none', fontWeight: 700, bgcolor: T.teal, '&:hover': { bgcolor: T.tealHover }, ...rest.sx }}
    >
      {children}
    </Button>
  );
}

export function GhostButton({ children, ...rest }) {
  const T = useT();
  return (
    <Button {...rest} sx={{ textTransform: 'none', fontWeight: 700, color: T.textMuted, ...rest.sx }}>
      {children}
    </Button>
  );
}
