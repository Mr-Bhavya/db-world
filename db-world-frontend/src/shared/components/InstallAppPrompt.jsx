import React, { useEffect, useState } from 'react';
import InstallMobileRoundedIcon from '@mui/icons-material/InstallMobileRounded';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import { isNative } from '@shared/platform/platform';
import { getApiBaseUrl } from '@shared/config/apiBaseUrl';
import AppPromoDialog from '@shared/components/AppPromoDialog';

const DISMISS_KEY = 'dbworld_install_prompt_dismissed';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // re-offer after a week
const SHOW_DELAY_MS = 1200;                 // let the page settle before inviting

// Android browser, NOT the installed app. iOS can't sideload an APK, so we never
// prompt there. A tablet on Android web still benefits, so we key off the UA, not
// the phone viewport width.
function isAndroidWeb() {
  if (isNative || typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent || '');
}

// Already running as an installed PWA — no point pushing the APK.
function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
}

function recentlyDismissed() {
  try {
    const ts = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    return ts && Date.now() - ts < SNOOZE_MS;
  } catch { return false; }
}

function snooze() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
}

/**
 * "Install the app" invite for Android mobile-web visitors. Uses the shared
 * AppPromoDialog (same look as the in-app update prompt) and downloads the APK
 * through the public /api/app/download endpoint (302 → GitHub release asset).
 * Shown once, then snoozed for a week; never on iOS, the installed app, or an
 * already-installed PWA. Web-only, so this is a no-op inside the native app.
 */
export default function InstallAppPrompt() {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!isAndroidWeb() || isStandalone() || recentlyDismissed()) return undefined;
    const t = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const close = () => { snooze(); setOpen(false); };

  const download = () => {
    const url = `${getApiBaseUrl()}/api/app/download`;
    // An APK is served as an attachment, so this downloads without navigating away.
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    a.setAttribute('download', '');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStarted(true);
  };

  if (!open) return null;

  const benefits = [
    { icon: <CloudOffRoundedIcon />, label: 'Offline vault — your passwords, even with no signal' },
    { icon: <NotificationsActiveRoundedIcon />, label: 'Instant alerts for IPOs, requests & more' },
    { icon: <RocketLaunchRoundedIcon />, label: 'Faster & full-screen — no browser bars' },
  ];

  return (
    <AppPromoDialog
      open
      dismissible
      onClose={close}
      icon={<InstallMobileRoundedIcon />}
      title={started ? 'Download started' : 'Get the DB-World app'}
      subtitle={
        started
          ? 'Open the downloaded file to install. You may need to allow installs from your browser.'
          : 'Install the Android app for offline access and a faster, native experience.'
      }
      benefits={started ? undefined : benefits}
      note={started ? { tone: 'warning', text: 'Not seeing it? Check your notifications or Downloads folder.' } : null}
      primaryLabel={started ? 'Done' : 'Download app'}
      onPrimary={started ? close : download}
      secondaryLabel={started ? undefined : 'Not now'}
      onSecondary={close}
    />
  );
}
