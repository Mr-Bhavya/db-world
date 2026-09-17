import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import SystemUpdateAltRoundedIcon from '@mui/icons-material/SystemUpdateAltRounded';
import axiosInstance from '@shared/components/ui/utils/AxiosInstants';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';
import AppPromoDialog from '@shared/components/AppPromoDialog';
import { useAuth } from '@features/auth/context/Authentication';

const AppUpdate = registerPlugin('AppUpdate');

// Pretty-print the release size when the backend reports it (0 / missing → hidden).
function formatSize(bytes) {
  if (!bytes || bytes < 1024) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * What to do with an update that targets the "admin" audience, given the current auth snapshot.
 *
 * <p>Three outcomes, and the third is the one whose absence caused the bug:
 * <ul>
 *   <li>{@code 'show'} — a confirmed ADMIN/OWNER.</li>
 *   <li>{@code 'discard'} — a confirmed non-admin. A real answer, so stop holding the update.</li>
 *   <li>{@code 'wait'} — no answer YET. Either the initial verify is still running, or the app is
 *       biometric-locked, or nobody is signed in and still might be.</li>
 * </ul>
 *
 * <p>`locked` matters as much as `loading`. With biometric unlock enabled the auth context starts
 * at <code>{ ...INITIAL_AUTH, loading: false, locked: true }</code> — loading is already false
 * while role is still null, because the fingerprint prompt has not been answered. Treating that as
 * "resolved, not an admin" discarded the update before the user could possibly have unlocked.
 *
 * @param {{loading?: boolean, locked?: boolean, isAuthenticated?: boolean, role?: string}} auth
 * @returns {'show'|'discard'|'wait'}
 */
export function adminAudienceDecision(auth) {
  if (auth?.loading || auth?.locked) return 'wait';
  const role = String(auth?.role ?? '').replace(/^ROLE_/i, '').trim().toUpperCase();
  if (role === 'ADMIN' || role === 'OWNER') return 'show';
  return auth?.isAuthenticated ? 'discard' : 'wait';
}

/**
 * Self-update gate for the sideloaded Android app. On launch it asks the
 * backend for the latest published build (GET /api/app/version) and, if newer
 * than the installed versionCode, shows the shared AppPromoDialog. Tapping
 * Update downloads the APK and hands off to the system installer (native
 * AppUpdate plugin). A `mandatory` release (or installed build below
 * minSupportedCode) renders the dialog non-dismissable. No-op on web.
 *
 * releaseAudience logic:
 *   "all"   → prompt shown immediately to every user (default, same as before)
 *   "admin" → prompt deferred until auth resolves; only ADMIN / OWNER see it
 * minSupportedCode floor always overrides the audience filter — if the installed
 * build is dangerously old, every user is force-prompted regardless.
 */
export default function AppUpdateGate() {
  const { auth } = useAuth();

  const [info, setInfo] = useState(null);           // latest build + computed `mandatory`
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [needsPerm, setNeedsPerm] = useState(false);
  const [error, setError] = useState(null);
  // Holds a fetched update that targets "admin" audience until auth is ready.
  const [pendingAdminUpdate, setPendingAdminUpdate] = useState(null);

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
        if (latest.versionCode <= curCode) return;

        const isBelowFloor = curCode < (latest.minSupportedCode ?? 0);
        const audience = latest.releaseAudience ?? 'all';

        // Floor override: everyone must update regardless of audience.
        if (audience === 'all' || isBelowFloor) {
          const mandatory = Boolean(latest.mandatory) || isBelowFloor;
          setInfo({ ...latest, mandatory });
          setOpen(true);
        } else {
          // "admin" audience — wait for auth to resolve before deciding.
          setPendingAdminUpdate({ ...latest, _curCode: curCode });
        }
      } catch { /* offline / no release / endpoint absent — silently skip */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Once auth is ready, evaluate any deferred admin-audience update.
   *
   * <p>"Ready" has to include `locked`, not just `loading`. When biometric unlock is enabled the
   * context starts the session at `{ ...INITIAL_AUTH, loading: false, locked: true }` — loading is
   * ALREADY false while the role is still null, because the user has not unlocked yet. The old
   * condition read that as "auth resolved, role is not admin", and then consumed the pending
   * update permanently. The dialog was thrown away before the fingerprint prompt had even been
   * answered, so an admin on a biometric-locked phone could never see an admin-audience release.
   *
   * <p>That is why this looked like a regression after v3.0.26: every release up to it shipped
   * `releaseAudience: "all"`, which takes the immediate path above and never touches this effect.
   * v3.0.27 and v3.0.28 were both published admin-only, which routed them straight into the bug.
   *
   * <p>Consumption is now tied to getting a real ANSWER. A signed-in non-admin is a definitive no.
   * An anonymous visitor is not an answer at all — they may still sign in this session — so the
   * update keeps waiting rather than being discarded, which also covers "use password instead".
   */
  useEffect(() => {
    if (!pendingAdminUpdate) return;
    const decision = adminAudienceDecision(auth);
    if (decision === 'wait') return;
    if (decision === 'show') {
      setInfo({ ...pendingAdminUpdate, mandatory: Boolean(pendingAdminUpdate.mandatory) });
      setOpen(true);
    }
    setPendingAdminUpdate(null);
  }, [pendingAdminUpdate, auth]);

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
