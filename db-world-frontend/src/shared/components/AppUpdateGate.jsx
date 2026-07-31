import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';
import AppPromoDialog from '@shared/components/AppPromoDialog';

const AppUpdate = registerPlugin('AppUpdate');

// Pretty-print the release size when the backend reports it (0 / missing → hidden).
function formatSize(bytes) {
  if (!bytes || bytes < 1024) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Self-update gate for the sideloaded Android app. On launch it asks the
 * backend for the latest published build (GET /api/app/version) and, if newer
 * than the installed versionCode, shows the shared AppPromoDialog. Tapping
 * Update downloads the APK and hands off to the system installer (native
 * AppUpdate plugin). A `mandatory` release (or installed build below
 * minSupportedCode) renders the dialog non-dismissable. No-op on web.
 */
export default function AppUpdateGate() {
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

  const size = formatSize(info.sizeBytes);
  const chip = [info.versionName && `v${info.versionName}`, size].filter(Boolean).join(' · ') || null;

  // One inline status line: hard error > permission hint > mandatory notice.
  const note = error
    ? { tone: 'error', text: error }
    : needsPerm
      ? { tone: 'warning', text: 'Allow “Install unknown apps” for DB-World in the settings that just opened, then tap Update again.' }
      : info.mandatory
        ? { tone: 'warning', text: 'This update is required to keep using the app.' }
        : null;

  return (
    <AppPromoDialog
      open
      dismissible={!info.mandatory}
      onClose={() => setOpen(false)}
      icon={<SystemUpdateAltRoundedIcon />}
      title="Update available"
      chip={chip}
      subtitle="A newer version of DB-World is ready to install."
      body={info.changelog || null}
      note={note}
      progress={progress}
      busy={busy}
      primaryLabel={needsPerm ? 'Try again' : busy ? 'Starting…' : 'Update now'}
      onPrimary={startUpdate}
      secondaryLabel={info.mandatory ? undefined : 'Later'}
      onSecondary={() => setOpen(false)}
    />
  );
}
