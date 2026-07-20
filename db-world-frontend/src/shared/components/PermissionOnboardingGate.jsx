import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Box, Button, Dialog, Stack, Typography } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FolderIcon from '@mui/icons-material/Folder';
import { useT } from '@shared/theme';
import { useAuth } from '@features/auth/context/Authentication';
import DbWorldDownload from '@platform/android/DbWorldDownload';

/** Set once the rationale has been shown (whether the user allowed or skipped). */
export const PERMISSIONS_ONBOARDED_KEY = 'dbworld_permissions_onboarded';

/**
 * First-run permission rationale (Android only). Android has no install-time grant for runtime
 * permissions, so the best we can do is explain WHY before the first request. Shown once, after
 * login. "Allow" triggers the native request (notifications, then All-files-access via
 * DbWorldDownload.ensurePermissions); "Not now" just dismisses — permissions are re-requested
 * on demand later (App.jsx re-runs ensurePermissions on subsequent launches). No-op on web.
 */
export default function PermissionOnboardingGate() {
  const T = useT();
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    if (!auth.isAuthenticated) return;
    if (localStorage.getItem(PERMISSIONS_ONBOARDED_KEY)) return;
    setOpen(true);
  }, [auth.isAuthenticated]);

  const finish = () => {
    try { localStorage.setItem(PERMISSIONS_ONBOARDED_KEY, '1'); } catch { /* storage full — best-effort */ }
    setOpen(false);
  };

  const allow = async () => {
    setBusy(true);
    try { await DbWorldDownload.ensurePermissions(); } catch { /* denial is fine — re-requested on demand */ }
    setBusy(false);
    finish();
  };

  if (!open) return null;

  return (
    <Dialog
      open
      disableEscapeKeyDown
      onClose={(_e, reason) => { if (reason !== 'backdropClick') finish(); }}
      PaperProps={{ sx: { bgcolor: T.bg, color: T.text, borderRadius: 3, maxWidth: 420, m: 2 } }}
    >
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, textAlign: 'center' }}>A couple of permissions</Typography>
        <Typography sx={{ color: T.textMuted, mt: 0.5, textAlign: 'center', fontSize: 14 }}>
          DB World uses these to work smoothly. You can change them anytime in your phone&apos;s Settings.
        </Typography>

        <Stack spacing={2} sx={{ mt: 3 }}>
          <PermRow T={T} icon={<NotificationsActiveIcon sx={{ color: T.teal }} />} title="Notifications"
                   desc="Show download progress and let you know when files finish." />
          <PermRow T={T} icon={<FolderIcon sx={{ color: T.teal }} />} title="Storage"
                   desc="Save your downloads and documents to your device." />
        </Stack>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 3 }}>
          <Button onClick={finish} disabled={busy} sx={{ color: T.textMuted, textTransform: 'none' }}>Not now</Button>
          <Button
            onClick={allow}
            disabled={busy}
            variant="contained"
            sx={{ bgcolor: T.teal, textTransform: 'none', fontWeight: 700, px: 3, '&:hover': { bgcolor: T.tealHover } }}
          >
            {busy ? 'Requesting…' : 'Allow'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

function PermRow({ T, icon, title, desc }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ mt: 0.25 }}>{icon}</Box>
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{title}</Typography>
        <Typography sx={{ color: T.textMuted, fontSize: 13 }}>{desc}</Typography>
      </Box>
    </Box>
  );
}
