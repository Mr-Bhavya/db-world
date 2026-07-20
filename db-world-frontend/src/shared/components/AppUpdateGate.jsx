import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Box, Button, Dialog, LinearProgress, Typography } from '@mui/material';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import { useT } from '@shared/theme/ThemeContext';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';

const AppUpdate = registerPlugin('AppUpdate');

/**
 * Self-update gate for the sideloaded Android app. On launch it asks the
 * backend for the latest published build (GET /api/app/version) and, if newer
 * than the installed versionCode, shows an update dialog. Tapping Update
 * downloads the APK and hands off to the system installer (native AppUpdate
 * plugin). A `mandatory` release (or installed build below minSupportedCode)
 * renders the dialog non-dismissable. No-op on web.
 */
export default function AppUpdateGate() {
  const T = useT();
  const [info, setInfo] = useState(null);     // latest build + computed `mandatory`
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [needsPerm, setNeedsPerm] = useState(false);
  const [error, setError] = useState(null);

  // Check for a newer build once on mount (Android only).
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const cur = await CapacitorApp.getInfo();             // { build, version }
        const curCode = parseInt(cur?.build ?? '0', 10) || 0;
        const res = await axiosInstance.get('/api/app/version');
        const latest = res?.data?.data ?? res?.data;
        if (cancelled || !latest || typeof latest.versionCode !== 'number') return;
        if (latest.versionCode > curCode) {
          const mandatory = Boolean(latest.mandatory) || curCode < (latest.minSupportedCode ?? 0);
          setInfo({ ...latest, mandatory });
          setOpen(true);
        }
      } catch { /* offline / no release / endpoint absent — silently skip */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Download progress from the native plugin.
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return undefined;
    let handle;
    AppUpdate.addListener('updateProgress', (e) => {
      if (typeof e?.progress === 'number') setProgress(e.progress);
    }).then((h) => { handle = h; }).catch(() => {});
    return () => handle?.remove?.();
  }, []);

  const startUpdate = useCallback(async () => {
    if (!info) return;
    setBusy(true); setError(null); setNeedsPerm(false); setProgress(0);
    try {
      const base = getApiBaseUrl();
      const url = info.apkUrl?.startsWith('http') ? info.apkUrl : `${base}${info.apkUrl}`;
      const r = await AppUpdate.installApk({ url });
      if (r?.status === 'needs_permission') {
        // User was sent to the "install unknown apps" settings screen.
        setNeedsPerm(true); setBusy(false); setProgress(null);
      }
      // status 'installing' → the OS installer takes over from here.
    } catch {
      setError('Update failed. Please check your connection and try again.');
      setBusy(false); setProgress(null);
    }
  }, [info]);

  if (!open || !info) return null;

  return (
    <Dialog
      open
      disableEscapeKeyDown={info.mandatory}
      onClose={(_e, reason) => {
        if (info.mandatory) return;
        if (reason === 'backdropClick') return;
        setOpen(false);
      }}
      PaperProps={{ sx: { bgcolor: T.bg, color: T.text, borderRadius: 3, maxWidth: 420, m: 2 } }}
    >
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <SystemUpdateAltIcon sx={{ fontSize: 44, color: T.teal, mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Update available</Typography>
        <Typography sx={{ color: T.textMuted, mt: 0.5 }}>Version {info.versionName}</Typography>

        {info.changelog && (
          <Typography variant="body2" sx={{ color: T.textMuted, mt: 2, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
            {info.changelog}
          </Typography>
        )}

        {info.mandatory && (
          <Typography variant="caption" sx={{ color: T.warning, display: 'block', mt: 2, fontWeight: 600 }}>
            This update is required to continue using the app.
          </Typography>
        )}
        {needsPerm && (
          <Typography variant="caption" sx={{ color: T.warning, display: 'block', mt: 2 }}>
            Allow &ldquo;Install unknown apps&rdquo; for DB World in the settings that just opened, then tap Update again.
          </Typography>
        )}
        {error && (
          <Typography variant="caption" sx={{ color: T.error, display: 'block', mt: 2 }}>{error}</Typography>
        )}

        {progress != null && (
          <Box sx={{ mt: 2.5 }}>
            <LinearProgress variant="determinate" value={progress}
              sx={{ borderRadius: 2, height: 6, bgcolor: 'rgba(255,255,255,.1)', '& .MuiLinearProgress-bar': { bgcolor: T.teal } }} />
            <Typography variant="caption" sx={{ color: T.textFaint, mt: 0.5, display: 'block' }}>{progress}%</Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 3 }}>
          {!info.mandatory && !busy && (
            <Button onClick={() => setOpen(false)} sx={{ color: T.textMuted, textTransform: 'none' }}>Later</Button>
          )}
          <Button
            onClick={startUpdate}
            disabled={busy}
            variant="contained"
            sx={{ bgcolor: T.teal, textTransform: 'none', fontWeight: 700, px: 3, '&:hover': { bgcolor: T.tealHover } }}
          >
            {busy ? (progress != null ? `Downloading ${progress}%` : 'Starting…') : (needsPerm ? 'Try again' : 'Update now')}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
