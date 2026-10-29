import React, { useId } from 'react';
import { Alert, Box, Button, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { useT } from '@shared/theme';
import SheetDialog from '@shared/components/SheetDialog';

export default function AppPromoDialog({
  open, dismissible = true, onClose, icon, title, subtitle, chip, benefits, body, note,
  progress = null, busy = false, primaryLabel, onPrimary, secondaryLabel, onSecondary,
  dismissLongLabel, onDismissLong, dismissLongIcon = <AccessTimeRoundedIcon />,
  primaryIcon = <DownloadRoundedIcon />,
}) {
  const T = useT();
  const titleId = useId();
  const descriptionId = useId();
  const showProgress = Number.isFinite(progress);
  const percentage = showProgress ? Math.min(100, Math.max(0, progress)) : null;

  return (
    <SheetDialog
      open={open}
      asSheet={false}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? descriptionId : undefined}
      disableEscapeKeyDown={!dismissible || busy}
      onClose={(_event, reason) => {
        if (dismissible && !busy && reason !== 'backdropClick') onClose?.();
      }}
      slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' } } }}
      PaperProps={{ sx: {
        bgcolor: T.bg, color: T.textPrimary, backgroundImage: 'none', border: `1px solid ${T.glassBorder}`,
        borderRadius: 2, width: 'calc(100% - 32px)', maxWidth: 480, m: 2,
        maxHeight: 'calc(100dvh - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        letterSpacing: 0,
      } }}
    >
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ px: { xs: 2, sm: 3 }, py: 2, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <Box sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: 1.5, bgcolor: T.tealBg, color: T.teal,
          display: 'grid', placeItems: 'center', '& .MuiSvgIcon-root': { fontSize: 28 } }}>{icon}</Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h2" id={titleId} sx={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{title}</Typography>
          <Typography sx={{ mt: 0.25, color: T.textMuted, fontSize: '0.78rem' }}>DB World for Android</Typography>
        </Box>
        {dismissible && <Tooltip title="Close"><span><IconButton disabled={busy} onClick={onClose} aria-label="Close" sx={{ color: T.textMuted, width: 44, height: 44 }}><CloseRoundedIcon /></IconButton></span></Tooltip>}
      </Stack>

      <Box sx={{ overflowY: 'auto', minHeight: 0, px: { xs: 2, sm: 3 }, py: 2.5 }}>
        {chip && <Typography sx={{ display: 'inline-block', mb: 1.5, px: 1, py: 0.5, bgcolor: T.tealBg, borderRadius: 1, color: T.teal, fontSize: '0.8rem', fontWeight: 700, overflowWrap: 'anywhere' }}>{chip}</Typography>}
        {subtitle && <Typography id={descriptionId} sx={{ color: T.textMuted, fontSize: '0.9rem', lineHeight: 1.6 }}>{subtitle}</Typography>}

        {benefits?.length > 0 && <Stack component="ul" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0, mt: 2.5 }}>
          {benefits.map((benefit, index) => <Stack component="li" key={index} direction="row" alignItems="flex-start" gap={1.25}>
            <Box sx={{ display: 'flex', color: T.teal, pt: 0.15, '& .MuiSvgIcon-root': { fontSize: 21 } }}>{benefit.icon || <CheckRoundedIcon />}</Box>
            <Typography sx={{ color: T.textPrimary, fontSize: '0.86rem', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{benefit.label}</Typography>
          </Stack>)}
        </Stack>}

        {body && <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${T.border}`, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: T.textMuted, fontSize: '0.85rem', lineHeight: 1.65 }}>{body}</Box>}

        {note && <Alert severity={note.tone === 'error' ? 'error' : note.tone === 'success' ? 'success' : 'warning'} sx={{ mt: 2, borderRadius: 1, overflowWrap: 'anywhere' }} role={note.tone === 'error' ? 'alert' : 'status'}>{note.text}</Alert>}

        {(showProgress || busy) && <Box sx={{ mt: 2.5 }} role="status" aria-live="polite">
          <Stack direction="row" justifyContent="space-between" gap={1} mb={1}>
            <Typography sx={{ color: T.textMuted, fontSize: '0.82rem' }}>{showProgress ? 'Downloading update' : 'Preparing update'}</Typography>
            {showProgress && <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{Math.round(percentage)}%</Typography>}
          </Stack>
          <LinearProgress aria-label="App update download" variant={showProgress ? 'determinate' : 'indeterminate'} value={percentage || 0}
            sx={{ height: 6, borderRadius: 1, bgcolor: T.tealBg, '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />
        </Box>}
      </Box>

      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 'max(16px, env(safe-area-inset-bottom))', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <Stack direction={{ xs: 'column', sm: 'row-reverse' }} gap={1}>
          <Button onClick={onPrimary} disabled={busy} variant="contained" disableElevation startIcon={primaryIcon}
            sx={{ flex: 1, minHeight: 48, borderRadius: 1, textTransform: 'none', fontWeight: 750, bgcolor: T.teal, color: '#ffffff', '&:hover': { bgcolor: T.tealHover } }}>{primaryLabel}</Button>
          {secondaryLabel && !busy && <Button onClick={onSecondary} sx={{ minHeight: 44, px: 2, color: T.textMuted, textTransform: 'none' }}>{secondaryLabel}</Button>}
        </Stack>
        {dismissLongLabel && onDismissLong && !busy && <Button onClick={onDismissLong} startIcon={dismissLongIcon} fullWidth
          sx={{ mt: 0.5, minHeight: 44, color: T.textMuted, fontSize: '0.8rem', textTransform: 'none' }}>{dismissLongLabel}</Button>}
      </Box>
    </SheetDialog>
  );
}