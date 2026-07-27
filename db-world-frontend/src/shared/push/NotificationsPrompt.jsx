import { useState } from 'react';
import { Box, Button, CircularProgress, IconButton, Typography } from '@mui/material';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import CloseIcon from '@mui/icons-material/Close';

import { useT } from '@shared/theme';

import { usePushNotifications } from './usePushNotifications';

/**
 * A gentle, dismissible invitation to turn on push notifications, shown only when push is supported
 * and the user hasn't decided yet (permission === 'default'). Mounting this also wires the push
 * hook's side effects (silent token re-sync for already-granted users + foreground-message toasts),
 * so it's the single mount point for web push on the hub. Renders nothing once enabled, denied, or
 * dismissed.
 */
export default function NotificationsPrompt() {
  const T = useT();
  const { supported, permission, busy, enable } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  if (!supported || permission !== 'default' || dismissed) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.25, sm: 2 },
        p: { xs: 1.5, sm: 2 },
        mb: { xs: 3, md: 4 },
        borderRadius: 3,
        border: `1px solid ${T.glassBorder}`,
        bgcolor: T.glass,
        backdropFilter: 'blur(12px)',
      }}
    >
      <Box
        sx={{
          width: { xs: 40, sm: 46 },
          height: { xs: 40, sm: 46 },
          borderRadius: 2.2,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: T.tealBg,
        }}
      >
        <NotificationsActiveOutlinedIcon sx={{ color: T.teal, fontSize: { xs: 22, sm: 26 } }} />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ color: T.textPrimary, fontWeight: 800, fontSize: { xs: '0.92rem', sm: '1.02rem' }, lineHeight: 1.2 }}>
          Get IPO alerts
        </Typography>
        <Typography sx={{ color: T.textMuted, fontSize: { xs: '0.78rem', sm: '0.85rem' }, lineHeight: 1.45, mt: 0.25 }}>
          Open, closing soon, allotment and listing — the moment they happen.
        </Typography>
      </Box>

      <Button
        variant="contained"
        onClick={enable}
        disabled={busy}
        startIcon={busy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
        sx={{
          flexShrink: 0,
          bgcolor: T.teal,
          color: '#fff',
          borderRadius: 2,
          px: { xs: 2, sm: 2.5 },
          py: 0.9,
          fontWeight: 800,
          fontSize: { xs: '0.82rem', sm: '0.9rem' },
          textTransform: 'none',
          whiteSpace: 'nowrap',
          '&:hover': { bgcolor: T.tealHover },
        }}
      >
        {busy ? 'Enabling…' : 'Enable'}
      </Button>

      <IconButton
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notifications prompt"
        size="small"
        sx={{ flexShrink: 0, color: T.textFaint, '&:hover': { color: T.textPrimary } }}
      >
        <CloseIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
}
